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
    const pct = `${sign}${quote.changePercent.toFixed(2)}%`;
    if (typeof quote.price === 'number' && Number.isFinite(quote.price)) {
      const cur = quote.currency === 'INR' ? '₹' : quote.currency === 'USD' ? '$' : '';
      const formattedPrice = quote.price >= 1 ? quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : quote.price.toFixed(4);
      return `${symbol} ${cur}${formattedPrice} (${pct})`;
    }
    return `${symbol} (${pct})`;
  }
  return `${symbol} — change unavailable`;
}

/** Article links indicate relevance, not a prediction or proof of price impact. */
export function newsNotificationBody(headline: string, symbols: string[] = [], quotes: QuoteLike[] = [], region?: 'india' | 'global') {
  const related = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
  // Regional indices provide context, never evidence that an unnamed company was affected.
  const context = !related.length && region === 'india';
  const selected = context ? ['NIFTY50', 'SENSEX'] : related;
  if (!selected.length) return `${headline}\nNo specific stock identified`;
  const quoteMap = new Map(quotes.filter(q => q?.symbol).map(q => [q.symbol.toUpperCase(), q]));
  const formatted = selected.map(symbol => formatStockChange(quoteMap.get(symbol) ?? { symbol }));
  const label = context ? 'Market context (quote snapshot)' : 'Related stocks (quote snapshot)';
  return `${headline}\n${label}: ${formatted.join(', ')}`;
}
