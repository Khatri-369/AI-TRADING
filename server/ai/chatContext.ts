import type { Overview, NewsResponse } from '../../shared/types';
import type { ChatSource } from '../../shared/chat';
import type { ChatFocus } from '../../shared/chat';
import { movingAverage, type Candle } from '../../shared/research';

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
      coverage: 'Only supplied tracked quotes, headlines and explicitly attached chart evidence are available. No web search, financial statements or portfolio holdings.',
    },
  };
}

export function prepareChartEvidence(focus: ChatFocus, chart: { candles: Candle[]; provider: string; status: string; asOf: string | null } | null) {
  const candles = chart?.candles ?? [];
  const last = candles.at(-1);
  return {
    source: { id: `chart:${focus.symbol}`, label: `${focus.symbol} ${focus.interval} chart`, provider: chart?.provider ?? 'Unavailable', asOf: chart?.asOf ?? null, status: chart?.status ?? 'unavailable', url: `/asset/${encodeURIComponent(focus.symbol)}` } satisfies ChatSource,
    evidence: {
      sourceId: `chart:${focus.symbol}`, symbol: focus.symbol, interval: focus.interval, range: focus.range,
      provider: chart?.provider ?? null, status: chart?.status ?? 'unavailable', asOf: chart?.asOf ?? null,
      candles: candles.slice(-60), totalBars: candles.length,
      sma20: movingAverage(candles, 20).at(-1) ?? null, ema20: movingAverage(candles, 20, true).at(-1) ?? null,
      limitations: `Latest bar (${last?.time ?? 'unavailable'}) may be incomplete. Indicators use available fetched history; fewer than 20 bars means no indicator. User drawings and plan in request.focus are hypothetical annotations, not market observations or recommendations.`,
    },
  };
}
