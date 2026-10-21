/** Article links indicate relevance, not a prediction or proof of price impact. */
export function newsNotificationBody(headline: string, symbols: string[] = []) {
  const related = [...new Set(symbols.map(symbol => symbol.trim()).filter(Boolean))];
  return `${headline}\n${related.length ? `Related stocks: ${related.join(', ')}` : 'No specific stock identified'}`;
}
