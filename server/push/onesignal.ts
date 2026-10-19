import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { NewsResponse } from '../../shared/types';

export function authorizedNewsJob(header: string | undefined, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(secret); const supplied = Buffer.from(header.slice(7));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

const optionsSchema = z.object({ appId: z.string().uuid(), apiKey: z.string().min(1), siteUrl: z.string().url().refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
}) });
interface Options { appId?: string; apiKey?: string; siteUrl?: string; fetcher?: typeof fetch; now?: () => number }

/** OneSignal owns subscriptions and idempotency state; no serverless disk or browser timer. */
export class OneSignalNewsPush {
  constructor(private options: Options) {}
  get configured() { return optionsSchema.safeParse(this.options).success; }
  async deliver(news: NewsResponse) {
    const options = optionsSchema.parse(this.options);
    if (news.status === 'unavailable' || news.status === 'stale') return { accepted: 0, skipped: 'feed-unavailable' };
    const now = (this.options.now ?? Date.now)();
    // A small, recent batch prevents an initial subscription from receiving an old news dump.
    const candidates = [...new Map(news.articles.filter(article => {
      const stamp = Date.parse(article.publishedAt);
      return stamp <= now && stamp > now - 15 * 60_000;
    }).map(article => [article.id, article])).values()]
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    const regional = ['india', 'global'].flatMap(region => {
      const article = candidates.find(item => item.region === region); return article ? [article] : [];
    });
    const articles = [...new Map([...regional, ...candidates].map(article => [article.id, article])).values()].slice(0, 3);
    let accepted = 0;
    let noRecipients = 0;
    for (const article of articles) {
      const bytes = createHash('sha256').update(`${options.appId}:${article.id}:${article.publishedAt}`).digest().subarray(0, 16);
      bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
      const hex = bytes.toString('hex');
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const response = await (this.options.fetcher ?? fetch)('https://api.onesignal.com/notifications', {
        method: 'POST', headers: { Authorization: `Key ${options.apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ app_id: options.appId, target_channel: 'push',
          filters: [{ field: 'tag', key: 'market_news', relation: '=', value: 'on' }],
          headings: { en: `Tradexa · ${article.region === 'india' ? 'India' : 'Global'} news` },
          contents: { en: `${article.headline.slice(0, 150)}${article.relatedAssets.length ? `\nRelated: ${article.relatedAssets.slice(0, 4).join(', ')}` : ''}` },
          data: { articleId: article.id, relatedAssets: article.relatedAssets, region: article.region ?? 'global' },
          url: new URL('/news', options.siteUrl).href, ttl: 1800, priority: 10,
          idempotency_key: id, web_push_topic: id,
        }),
      });
      if (!response.ok) throw new Error(`Push provider rejected the news job (${response.status}).`);
      const body = await response.json() as { id?: string };
      if (body.id) accepted++;
      else noRecipients++;
    }
    return { accepted, checked: articles.length, noRecipients,
      ...(articles.length === 0 ? { skipped: 'no-recent-news' } : {}),
    };
  }
}

export const oneSignalPush = new OneSignalNewsPush({ appId: process.env.ONESIGNAL_APP_ID, apiKey: process.env.ONESIGNAL_REST_API_KEY, siteUrl: process.env.PUBLIC_SITE_URL });
export const usesOneSignal = () => Boolean(process.env.ONESIGNAL_APP_ID || process.env.ONESIGNAL_REST_API_KEY);
