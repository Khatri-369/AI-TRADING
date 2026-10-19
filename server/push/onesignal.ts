import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { logger } from '../logger';
import { RedisNewsQueue, queueHeadline, type NewsQueue, type QueuedHeadline } from './newsQueue';
import type { NewsResponse } from '../../shared/types';

export function authorizedNewsJob(header: string | undefined, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(secret); const supplied = Buffer.from(header.slice(7));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

const optionsSchema = z.object({ appId: z.string().uuid(), apiKey: z.string().trim().min(1) });
interface Options {
  appId?: string; apiKey?: string; queue?: NewsQueue; fetcher?: typeof fetch;
  now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export function notificationKey(appId: string, key: string) {
  const bytes = createHash('sha256').update(`${appId}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function retryDelay(attempts: number, retryAfter: string | null, now: number) {
  const seconds = Number(retryAfter);
  const advised = retryAfter === null ? 0 : Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
  return Math.max(300000, Math.min(86400000, 300000 * 2 ** Math.min(attempts - 1, 8)), Number.isFinite(advised) ? advised : 0);
}

export class OneSignalNewsPush {
  constructor(private options: Options) {}
  get configured() { return optionsSchema.safeParse(this.options).success && Boolean(this.options.queue?.configured); }
  async deliver(getNews: (() => Promise<NewsResponse>) | NewsResponse) {
    const options = optionsSchema.parse(this.options);
    const queue = this.options.queue;
    if (!queue?.configured) throw new Error('Persistent news queue is required');
    const owner = randomUUID();
    if (!await queue.acquire(owner)) return { skipped: 'job-already-running', accepted: 0, failed: 0, detected: 0, pending: 0, review: 0, feedUnavailable: false };
    const now = this.options.now ?? Date.now;
    const sleep = this.options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const deadline = now() + 20000;
    let detected = 0; let accepted = 0; let failed = 0; let feedUnavailable = false;
    try {
      if (await queue.pollDue(now())) {
        let news: NewsResponse | undefined;
        try { news = typeof getNews === 'function' ? await getNews() : getNews; }
        catch {
          feedUnavailable = true;
          await queue.enqueue(owner, [], now());
          logger.error('News feed request failed; draining saved backlog');
        }
        if (news) {
          feedUnavailable = news.status === 'unavailable' || news.status === 'stale' || Boolean(news.error);
          // Even cached/stale observations can contain unseen headlines. Dedup is durable.
          const records = news.articles.map(queueHeadline);
          detected = await queue.enqueue(owner, records, now());
          if (feedUnavailable) logger.warn('News provider coverage incomplete; saved available headlines');
        }
      }
      // Bounded work per invocation; all excess remains in Redis for the next job.
      for (let batch = 0; batch < 40 && now() < deadline; batch++) {
        const record = await queue.next(owner, now());
        if (!record) break;
        if (now() - record.firstAttempt! >= 28 * 86400000) {
          record.state = 'review'; record.error = 'idempotency-window-review';
          await queue.save(owner, record, now()); failed++;
          logger.error('Headline requires review before idempotency expires', { key: record.key });
          continue;
        }
        const result = await this.send(record, options);
        if (result.id) {
          record.state = 'accepted'; record.messageId = result.id; delete record.error;
          // A failed commit leaves a retryable record with the SAME idempotency key.
          await queue.save(owner, record, now()); accepted++;
        } else {
          record.error = result.error; failed++;
          const due = now() + retryDelay(record.attempts, result.retryAfter ?? null, now());
          await queue.save(owner, record, due, result.pause ? due : 0);
          logger.error('Headline delivery deferred', { key: record.key, attempt: record.attempts, reason: result.error, retryAt: new Date(due).toISOString() });
          if (result.pause) break;
        }
        // At most two creates/second, also serialized across invocations by Redis lease.
        await sleep(500);
      }
      const counts = await queue.counts();
      const result = { detected, accepted, failed, ...counts, feedUnavailable, skipped: undefined as string | undefined };
      logger.info('News delivery job completed', result);
      return result;
    } finally {
      try { await queue.release(owner); } catch { logger.error('News job lease release failed; lease will expire'); }
    }
  }
  private async send(record: QueuedHeadline, options: { appId: string; apiKey: string }) {
    const id = notificationKey(options.appId, record.key);
    try {
      const response = await (this.options.fetcher ?? fetch)('https://api.onesignal.com/notifications', {
        method: 'POST', redirect: 'error', headers: { Authorization: `Key ${options.apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
        body: JSON.stringify({ app_id: options.appId, target_channel: 'push',
          filters: [{ field: 'tag', key: 'market_news', relation: '=', value: 'on' }],
          headings: { en: `TRADEXA · ${record.article.source}` },
          contents: { en: record.article.headline }, url: record.article.url,
          data: { articleId: record.article.id, publisher: record.article.source, articleUrl: record.article.url, relatedAssets: record.article.relatedAssets },
          ttl: 86400, priority: 10, idempotency_key: id,
        }),
      });
      if (!response.ok) return { error: `provider-http-${response.status}`, retryAfter: response.headers.get('retry-after'), pause: response.status === 429 || response.status === 401 || response.status === 403 || response.status >= 500 };
      const body = await response.json() as { id?: string };
      if (typeof body.id === 'string' && body.id) return { id: body.id };
      return { error: 'no-message-id-or-no-subscribers', pause: true };
    } catch { return { error: 'provider-network-or-invalid-response', pause: true }; }
  }
}

export const oneSignalPush = new OneSignalNewsPush({ appId: process.env.ONESIGNAL_APP_ID, apiKey: process.env.ONESIGNAL_REST_API_KEY,
  queue: new RedisNewsQueue(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN, process.env.ONESIGNAL_APP_ID),
});
export const usesOneSignal = () => Boolean(process.env.ONESIGNAL_APP_ID || process.env.ONESIGNAL_REST_API_KEY);
