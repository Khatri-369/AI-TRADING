export interface QuoteLike {
  symbol: string;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string;
}

export function formatStockChange(quote: QuoteLike): string {
  const symbol = quote.symbol;
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
  return symbol;
}

/** Article links indicate relevance, not a prediction or proof of price impact. */
export function newsNotificationBody(headline: string, symbols: string[] = [], quotes?: QuoteLike[]) {
  const related = [...new Set(symbols.map(symbol => symbol.trim()).filter(Boolean))];
  if (!related.length) return `${headline}\nNo specific stock identified`;

  if (quotes && quotes.length > 0) {
    const quoteMap = new Map<string, QuoteLike>();
    for (const q of quotes) {
      if (q?.symbol) quoteMap.set(q.symbol.toUpperCase(), q);
    }
    const formatted = related.map(sym => {
      const found = quoteMap.get(sym.toUpperCase());
      return found ? formatStockChange(found) : sym;
    });
    return `${headline}\nRelated stocks: ${formatted.join(', ')}`;
  }

  return `${headline}\nRelated stocks: ${related.join(', ')}`;
}
