import 'dotenv/config';
import { MarketProviders } from '../server/market/providers';
import { ASSET_BY_SYMBOL } from '../shared/assets';
import { UpstoxWebSocketClient } from '../server/market/websocket';
import { analyze, AIServiceError } from '../server/ai/index';

// Explicit live smoke test: uses configured read-only credentials; never prints secrets.
const providers = new MarketProviders();
for (const [name, task] of [
  ['India quotes', () => providers.indiaQuotes()], ['US AAPL', () => providers.usQuote('AAPL')],
  ['Crypto', () => providers.cryptoQuotes()], ['Gold', () => providers.metalQuote('XAU')],
  ['Silver', () => providers.metalQuote('XAG')], ['USD/INR', () => providers.forexQuote()],
  ['News', () => providers.news()],
] as const) {
  try { const result = await task(); console.log(JSON.stringify({ feature: name, ok: true, count: result.length, ...('symbol' in (result[0] ?? {}) ? { symbols: result.map(row => 'symbol' in row ? row.symbol : '') } : {}) })); }
  catch (error) { console.log(JSON.stringify({ feature: name, ok: false, error: error instanceof Error ? error.message : 'Request failed' })); }
}
for (const symbol of ['RELIANCE', 'RELIANCE.BSE', 'TCS.BSE', 'NIFTY50', 'BANKNIFTY', 'SENSEX']) {
  for (const range of ['1D', '5D', '1M', '3M', '6M', '1Y'] as const) {
    try { const points = await providers.history(ASSET_BY_SYMBOL.get(symbol)!, range); console.log(JSON.stringify({ feature: 'History', symbol, range, points: points.length, first: points[0]?.time, last: points.at(-1)?.time })); }
    catch (error) { console.log(JSON.stringify({ feature: 'History', symbol, range, error: error instanceof Error ? error.message : 'Request failed' })); }
  }
}
const ticks = new Set<string>();
const socket = new UpstoxWebSocketClient(process.env.UPSTOX_ANALYTICS_TOKEN, tick => ticks.add(tick.instrumentKey));
try {
  const instruments = await providers.indiaInstruments();
  await socket.start([...instruments.values()]);
  await new Promise(resolve => setTimeout(resolve, 12_000));
  console.log(JSON.stringify({ feature: 'Upstox WebSocket', ...socket.getStatus(), validatedInstruments: ticks.size }));
} finally { socket.stop(); }
if (process.argv.includes('--ai')) {
  for (const engine of ['gemini', 'finbert'] as const) {
    try { const result = await analyze({ headline: 'Quarterly company revenue increased while operating margins improved.', engine }); console.log(JSON.stringify({ feature: 'AI', engine, status: result.engineStatus, sentiment: result.sentiment })); }
    catch (error) { console.log(JSON.stringify({ feature: 'AI', engine, error: error instanceof AIServiceError ? error.message : 'Unexpected failure' })); }
  }
}

