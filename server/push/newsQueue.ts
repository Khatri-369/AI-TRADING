import { createHash } from 'node:crypto';
import { newsNotificationBody } from '../../shared/newsNotification';
import type { NewsArticle } from '../../shared/types';

export interface QueuedHeadline {
  key: string;
  article: NewsArticle;
  attempts: number;
  deliveryGeneration?: number;
  notificationBody?: string;
  firstAttempt?: number;
  messageId?: string;
  error?: string;
  state: 'pending' | 'accepted' | 'review';
}
export function canonicalArticleUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid article URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}
export function queueHeadline(article: NewsArticle): QueuedHeadline {
  const url = canonicalArticleUrl(article.url);
  return { key: createHash('sha256').update(url).digest('hex'), article: { ...article, url }, notificationBody: newsNotificationBody(article.headline, article.relatedAssets), attempts: 0, state: 'pending' };
}
export interface NewsQueue {
  configured: boolean;
  acquire(owner: string): Promise<boolean>;
  release(owner: string): Promise<void>;
  pollDue(now: number): Promise<boolean>;
  enqueue(owner: string, records: QueuedHeadline[], now: number): Promise<number>;
  next(owner: string, now: number): Promise<QueuedHeadline | null>;
  save(owner: string, record: QueuedHeadline, due: number, cooldown?: number): Promise<void>;
  counts(): Promise<{ pending: number; review: number }>;
}

// Keep article JSON opaque to Lua cjson (which otherwise changes empty arrays to objects).
function serialize(record: QueuedHeadline) { return JSON.stringify({ ...record, article: JSON.stringify(record.article) }); }

// All related keys share a Redis hash slot. Records and dedup tombstones never expire.
export const queueScripts = {
  release: `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`,
  enqueue: `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return redis.error_reply('LEASE_LOST') end
    local added = 0
    for i=3,#ARGV,2 do
      if redis.call('HSETNX', KEYS[2], ARGV[i], ARGV[i+1]) == 1 then
        redis.call('ZADD', KEYS[3], ARGV[2], ARGV[i]); added = added + 1
      end
    end
    redis.call('SET', KEYS[4], ARGV[2])
    return added`,
  next: `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return redis.error_reply('LEASE_LOST') end
    if tonumber(redis.call('GET', KEYS[4]) or '0') > tonumber(ARGV[2]) then return nil end
    local ids = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', ARGV[2], 'LIMIT', 0, 1)
    if #ids == 0 then return nil end
    local record = cjson.decode(redis.call('HGET', KEYS[2], ids[1]))
    if not record.firstAttempt then record.firstAttempt = tonumber(ARGV[2]) end
    record.attempts = record.attempts + 1
    local value = cjson.encode(record)
    redis.call('HSET', KEYS[2], ids[1], value)
    redis.call('ZADD', KEYS[3], tonumber(ARGV[2]) + 120000, ids[1])
    return value`,
  save: `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return redis.error_reply('LEASE_LOST') end
    redis.call('HSET', KEYS[2], ARGV[2], ARGV[3])
    if ARGV[5] == 'pending' then redis.call('ZADD', KEYS[3], ARGV[4], ARGV[2])
    else redis.call('ZREM', KEYS[3], ARGV[2]) end
    if ARGV[5] == 'review' then redis.call('SADD', KEYS[4], ARGV[2]) end
    if tonumber(ARGV[6]) > 0 then redis.call('SET', KEYS[5], ARGV[6]) end
    return 1`,
};

export class RedisNewsQueue implements NewsQueue {
  private prefix: string;
  constructor(private url?: string, private token?: string, appId = '', private fetcher = fetch) {
    this.prefix = `tradexa:news:v1:{${appId}}:`;
  }
  get configured() {
    try { const u = new URL(this.url ?? ''); return u.protocol === 'https:' && !u.username && !u.password && Boolean(this.token); }
    catch { return false; }
  }
  private async command<T>(...command: (string | number)[]): Promise<T> {
    if (!this.configured) throw new Error('News queue is not configured');
    try {
      const response = await this.fetcher(this.url!, { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command), signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error();
      const body = await response.json() as { result: T; error?: string };
      if (body.error || !Object.hasOwn(body, 'result')) throw new Error();
      return body.result;
    } catch { throw new Error('Persistent news queue operation failed; no delivery state assumed'); }
  }
  private eval<T>(script: string, keys: string[], args: (string | number)[]) {
    return this.command<T>('EVAL', script, keys.length, ...keys.map(key => this.prefix + key), ...args);
  }
  async acquire(owner: string) { return await this.command('SET', this.prefix + 'lock', owner, 'NX', 'PX', 120000) === 'OK'; }
  async release(owner: string) { await this.eval(queueScripts.release, ['lock'], [owner]); }
  async pollDue(now: number) {
    const last = await this.command<string | null>('GET', this.prefix + 'poll');
    return last === null || now - Number(last) >= 240000;
  }
  enqueue(owner: string, records: QueuedHeadline[], now: number) {
    return this.eval<number>(queueScripts.enqueue, ['lock', 'records', 'pending', 'poll'],
      [owner, now, ...records.flatMap(record => [record.key, serialize(record)])]);
  }
  async next(owner: string, now: number) {
    const value = await this.eval<string | null>(queueScripts.next, ['lock', 'records', 'pending', 'cooldown'], [owner, now]);
    if (!value) return null;
    const record = JSON.parse(value);
    return { ...record, article: JSON.parse(record.article) } as QueuedHeadline;
  }
  async save(owner: string, record: QueuedHeadline, due: number, cooldown = 0) {
    await this.eval(queueScripts.save, ['lock', 'records', 'pending', 'review', 'cooldown'],
      [owner, record.key, serialize(record), due, record.state, cooldown]);
  }
  async counts() {
    const pending = await this.command<number>('ZCARD', this.prefix + 'pending');
    const review = await this.command<number>('SCARD', this.prefix + 'review');
    return { pending, review };
  }
}
