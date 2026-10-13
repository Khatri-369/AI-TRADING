import { z } from 'zod';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import webpush from 'web-push';
import type { NewsResponse } from '../../shared/types';

export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname === 'web.push.apple.com' || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)
    );
  } catch { return false; }
}
export const subscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(allowedPushEndpoint),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,2}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/) }).strict(),
}).strict();
type Subscription = z.infer<typeof subscriptionSchema>;
const recordSchema = z.object({ subscription: subscriptionSchema, since: z.number().finite(), lastId: z.string(), lastSent: z.number().finite(), expiresAt: z.number().finite() });
type Record = z.infer<typeof recordSchema>;
interface Options { path?: string; publicKey?: string; privateKey?: string; subject?: string; now?: () => number; send?: (subscription: Subscription, payload: string) => Promise<unknown> }

/** Bounded single-instance store. Use a private persistent disk, never a serverless filesystem. */
export class NewsPushService {
  private records: Record[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  private failed = false;
  private running = false;
  private timer?: ReturnType<typeof setInterval>;
  private now: () => number;
  constructor(private options: Options) {
    this.now = options.now ?? Date.now;
    this.ready = this.load().catch(() => { this.failed = true; });
  }
  get configured() { return Boolean(this.options.path && /^[A-Za-z0-9_-]{87}$/.test(this.options.publicKey ?? '') && /^[A-Za-z0-9_-]{43}$/.test(this.options.privateKey ?? '') && /^(mailto:|https:\/\/)/.test(this.options.subject ?? '')); }
  async status() { await this.ready; return { configured: this.configured && !this.failed, publicKey: this.configured && !this.failed ? this.options.publicKey : null, intervalMinutes: 5 }; }
  private async load() {
    if (!this.configured) return;
    try { this.records = z.array(recordSchema).max(1000).parse(JSON.parse(await readFile(this.options.path!, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Notification storage could not be read.', { cause: error }); }
  }
  private async persist() {
    await mkdir(dirname(this.options.path!), { recursive: true });
    await writeFile(`${this.options.path}.tmp`, JSON.stringify(this.records), { mode: 0o600 });
    await rename(`${this.options.path}.tmp`, this.options.path!);
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      await this.ready;
      if (!this.configured || this.failed) throw new Error('Background news notifications are not configured.');
      return action();
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
  async subscribe(input: unknown) {
    const subscription = subscriptionSchema.parse(input);
    return this.exclusive(async () => {
      this.records = this.records.filter(record => record.expiresAt > this.now());
      const existing = this.records.find(record => record.subscription.endpoint === subscription.endpoint);
      if (existing && JSON.stringify(existing.subscription.keys) !== JSON.stringify(subscription.keys)) throw new Error('Subscription ownership could not be verified.');
      if (!existing && this.records.length >= 1000) throw new Error('Notification capacity reached.');
      if (existing) existing.expiresAt = this.now() + 90 * 86400000;
      else this.records.push({ subscription, since: this.now(), lastId: '', lastSent: 0, expiresAt: this.now() + 90 * 86400000 });
      await this.persist();
    });
  }
  async unsubscribe(input: unknown) {
    const subscription = subscriptionSchema.parse(input);
    return this.exclusive(async () => {
      this.records = this.records.filter(record => record.subscription.endpoint !== subscription.endpoint || JSON.stringify(record.subscription.keys) !== JSON.stringify(subscription.keys));
      await this.persist();
    });
  }
  async deliver(news: NewsResponse) {
    if (news.status === 'unavailable' || news.status === 'stale') return;
    return this.exclusive(async () => {
      const articles = news.articles.filter(a => Date.parse(a.publishedAt) <= this.now() && Date.parse(a.publishedAt) > this.now() - 6 * 3600000).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      const article = articles[0];
      if (!article) return;
      const id = createHash('sha256').update(`${article.id}:${article.publishedAt}`).digest('hex');
      this.records = this.records.filter(record => record.expiresAt > this.now());
      for (const record of [...this.records]) {
        if (record.since >= Date.parse(article.publishedAt) || record.lastId === id || this.now() - record.lastSent < 300000) continue;
        // Reserve before sending: a restart must not flood users with the same headline.
        record.lastId = id; record.lastSent = this.now();
        await this.persist();
        try {
          const payload = JSON.stringify({ title: 'Market news', body: article.headline.slice(0, 180), tag: 'market-news', url: '/news' });
          if (this.options.send) await this.options.send(record.subscription, payload);
          else await webpush.sendNotification(record.subscription, payload, { TTL: 1800, urgency: 'normal', timeout: 8000, vapidDetails: { subject: this.options.subject!, publicKey: this.options.publicKey!, privateKey: this.options.privateKey! } });
        } catch (error) {
          const code = (error as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) this.records = this.records.filter(value => value !== record);
          // Never log endpoints, encryption keys, or raw push-service errors.
        }
      }
      await this.persist();
    });
  }
  start(getNews: () => Promise<NewsResponse>) {
    if (!this.configured || this.timer) return;
    const tick = async () => {
      if (this.running) return;
      this.running = true;
      try { await this.ready; if (this.records.length && !this.failed) await this.deliver(await getNews()); } catch { console.warn('Background news check failed; next scheduled check will retry.'); }
      finally { this.running = false; }
    };
    this.timer = setInterval(() => void tick(), 300000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
}
