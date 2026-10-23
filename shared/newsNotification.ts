import { ASSET_BY_SYMBOL } from './assets';

export interface QuoteLike {
  symbol: string;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string;
  status?: string;
}

/** Put article-linked symbols in the collapsed mobile notification too. */
export function newsNotificationTitle(publisher: string, symbols: string[] = []) {
  const related = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
  const visible = related.slice(0, 3).join(', ');
  const extra = related.length > 3 ? ` +${related.length - 3}` : '';
  return `TRADEXA · ${visible ? `${visible}${extra} · ` : ''}${publisher || 'Market News'}`;
}

export function formatStockChange(quote: QuoteLike): string {
  const ticker = quote.symbol.trim().toUpperCase();
  const name = ASSET_BY_SYMBOL.get(ticker)?.name;
  const symbol = name && name !== ticker ? `${name} (${ticker})` : ticker;
  if (quote.status === 'unavailable' || quote.status === 'stale') return `${symbol} — change unavailable`;
  if (typeof quote.changePercent === 'number' && Number.isFinite(quote.changePercent)) {
    const sign = quote.changePercent > 0 ? '+' : '';
    const indicator = quote.changePercent > 0 ? '🟢 ▲' : quote.changePercent < 0 ? '🔴 ▼' : '⚪ —';
    const pct = `${indicator} ${sign}${quote.changePercent.toFixed(2)}%`;
    if (typeof quote.price === 'number' && Number.isFinite(quote.price)) {
      const cur = quote.currency === 'INR' ? '₹' : quote.currency === 'USD' ? '$' : '';
      const formattedPrice = quote.price >= 1 ? quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : quote.price.toFixed(4);
      return `${symbol} ${cur}${formattedPrice} (${pct})`;
    }
    return `${symbol} (${pct})`;
  }
  return `${symbol} — change unavailable`;
}

/** Extract an explicitly named IPO subject, without inventing a ticker or live quote. */
export function ipoHeadlineContext(headline: string): string | undefined {
  if (/[?]/.test(headline) || /^(?:could|will|can|may|might|should|would)\b/i.test(headline)) return undefined;
  const match = headline.match(/^([\p{L}\p{N}][\p{L}\p{N} &'.()-]{0,79}?)\s+(?:lists|listed|debuts|debuted)\s+at\s+(\d+(?:\.\d+)?)%\s+(premium|discount)\s+(?:over|to|against)\s+(?:the\s+)?(?:IPO|issue)\s+price\b/iu);
  if (!match) return undefined;
  const [, company, percent, direction] = match;
  const indicator = Number(percent) === 0 ? '⚪ —' : direction.toLowerCase() === 'premium' ? '🟢 ▲' : '🔴 ▼';
  return `Company in headline: ${company} — ${indicator} ${percent}% listing ${direction.toLowerCase()} vs IPO price (reported); live change unavailable`;
}

/** Article links indicate relevance, not a prediction or proof of price impact. */
export function newsNotificationBody(
  headline: string,
  symbols: string[] = [],
  quotes: QuoteLike[] = [],
  region?: 'india' | 'global',
  sentiment?: 'Positive' | 'Negative' | 'Neutral'
) {
  const related = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
  const sentimentSuffix = sentiment ? ` · Sentiment: ${sentiment}` : '';
  const ipoContext = !related.length ? ipoHeadlineContext(headline) : undefined;
  if (ipoContext) return `${headline}\n${ipoContext}${sentimentSuffix}`;
  // Regional indices provide context, never evidence that an unnamed company was affected.
  const context = !related.length && region === 'india';
  const selected = context ? ['NIFTY50', 'SENSEX'] : related;
  if (!selected.length) return `${headline}\nNo verified stock ticker linked${sentimentSuffix}`;
  const quoteMap = new Map(quotes.filter(q => q?.symbol).map(q => [q.symbol.toUpperCase(), q]));
  const formatted = selected.map(symbol => formatStockChange(quoteMap.get(symbol) ?? { symbol }));
  const label = context ? 'Market context (quote snapshot)' : 'Related stocks (quote snapshot)';
  return `${headline}\n${label}: ${formatted.join(', ')}${sentimentSuffix}`;
}

