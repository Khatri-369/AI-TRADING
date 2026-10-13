import type { Overview, NewsResponse } from '../../shared/types';
import type { ChatSource } from '../../shared/chat';

export function prepareChatContext(overview: Overview | null, news: NewsResponse | null, symbols: string[]) {
  const quotes = (overview?.quotes ?? []).filter(q => !symbols.length || symbols.includes(q.symbol));
  const articles = (news?.articles ?? []).filter(a => !symbols.length || a.relatedAssets.some(s => symbols.includes(s))).slice(0, 8);
  const sources: ChatSource[] = [
    ...quotes.map(q => ({ id: `quote:${q.symbol}`, label: `${q.name} (${q.symbol})`, provider: q.provider, asOf: q.asOf, status: q.status, url: `/asset/${encodeURIComponent(q.symbol)}` })),
    ...articles.map((a, index) => ({ id: `news:${index}`, label: a.headline, provider: a.source, asOf: a.publishedAt, status: news?.status ?? 'unavailable', url: /^https?:\/\//i.test(a.url) ? a.url : null })),
  ];
  return {
    sources,
    evidence: {
      observedAt: overview?.generatedAt ?? null,
      quotes: quotes.map(q => ({ sourceId: `quote:${q.symbol}`, symbol: q.symbol, name: q.name, price: q.price, currency: q.currency, changePercent: q.changePercent, asOf: q.asOf, status: q.status, session: q.session, provider: q.provider })),
      news: articles.map((a, index) => ({ sourceId: `news:${index}`, headline: a.headline, summary: a.summary.slice(0, 1000), publishedAt: a.publishedAt, source: a.source })),
      newsStatus: news?.status ?? 'unavailable',
      coverage: 'Only tracked instruments and supplied headlines; no web search, financial statements, historical series or portfolio holdings are available in this conversation.',
    },
  };
}
