import { gunzipSync } from 'node:zlib';
import { enrichNews, indianMarketNews } from './news';
import { z } from 'zod';
import { ASSETS } from '../../shared/assets';
import type { Asset, HistoryRange, MarketSession, NewsArticle } from '../../shared/types';
import { DataCache } from './cache';
import { dateString, fetchBytes, fetchJson, finite, optionalNumber, positive, validTime, type Fetcher } from './http';
import { marketSession, zonedClock } from './sessions';
import { candleSchema as fullCandleSchema, type Candle } from '../../shared/research';

export interface SourceQuote {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  asOf: string;
}
export type PricePoint = { time: string; price: number };
export type MarketEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'FINNHUB_API_KEY' | 'COINGECKO_DEMO_API_KEY' | 'UPSTOX_ANALYTICS_TOKEN' | 'GOLD_API_KEY' | 'GOLD_CACHE_SECONDS'>>;

const COIN_IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple' };
export const RANGE_DAYS: Record<HistoryRange, number> = { '1D': 1, '5D': 5, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
const DAY = 86_400_000;
const quoteSchema = z.object({ c: positive, d: optionalNumber, dp: optionalNumber, pc: optionalNumber, t: positive });
const cryptoQuoteSchema = z.object({ usd: positive, usd_24h_change: optionalNumber, usd_24h_vol: optionalNumber, last_updated_at: positive });
const fxSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), base: z.literal('USD'), quote: z.literal('INR'), rate: positive });
const upstoxQuoteSchema = z.object({
  instrument_token: z.string(), last_price: positive, net_change: optionalNumber, prev_close_price: optionalNumber,
  volume: optionalNumber, timestamp: dateString.optional(), last_trade_time: z.union([z.string(), finite]).optional(),
});
const instrumentSchema = z.object({ segment: z.string(), instrument_type: z.string(), instrument_key: z.string(), trading_symbol: z.string(), name: z.string() });
const candleSchema = z.tuple([dateString, finite, finite, finite, positive]).rest(finite.nullable());
const indiaHistorySchema = z.object({ status: z.literal('success'), data: z.object({ candles: z.array(candleSchema) }) });
const INDIA_INDICES: Record<string, { segment: string; name: string }> = {
  NIFTY50: { segment: 'NSE_INDEX', name: 'Nifty 50' },
  BANKNIFTY: { segment: 'NSE_INDEX', name: 'Nifty Bank' },
  SENSEX: { segment: 'BSE_INDEX', name: 'SENSEX' },
};

const sortedPoints = (points: PricePoint[]) => [...new Map(points.map((point) => [point.time, point])).values()].sort((a, b) => a.time.localeCompare(b.time));
const ensurePoints = (points: PricePoint[]) => {
  if (!points.length) throw new Error('Provider returned no historical data for this asset and range');
  return sortedPoints(points);
};

export class MarketProviders {
  private instruments = new DataCache<Map<string, string>>();
  private sessions = new DataCache<MarketSession>();

  constructor(readonly env: MarketEnvironment = process.env, private fetcher: Fetcher = fetch) {}

  get metalsProvider() { return this.env.GOLD_API_KEY ? 'goldapi' : 'gold-api'; }
  get metalTtl() {
    // GoldAPI.io's free allowance is 100 requests/month. Two daily quotes leave room for retries.
    const configured = Number(this.env.GOLD_CACHE_SECONDS);
    return Number.isFinite(configured) && configured >= 60 ? configured * 1_000 : this.env.GOLD_API_KEY ? DAY : 60_000;
  }

  private finnhubHeaders() {
    if (!this.env.FINNHUB_API_KEY) throw new Error('Set FINNHUB_API_KEY on the server to enable US equities and financial news');
    return { 'X-Finnhub-Token': this.env.FINNHUB_API_KEY };
  }
  private upstoxHeaders() {
    if (!this.env.UPSTOX_ANALYTICS_TOKEN) throw new Error('Set UPSTOX_ANALYTICS_TOKEN on the server to enable Indian equities and indices');
    return { Authorization: `Bearer ${this.env.UPSTOX_ANALYTICS_TOKEN}` };
  }
  private coinHeaders(): Record<string, string> {
    return this.env.COINGECKO_DEMO_API_KEY ? { 'x-cg-demo-api-key': this.env.COINGECKO_DEMO_API_KEY } : {};
  }

  async usQuote(symbol: string): Promise<SourceQuote[]> {
    const data = await fetchJson(this.fetcher, `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, quoteSchema, this.finnhubHeaders());
    return [{ symbol, price: data.c, change: data.d ?? null, changePercent: data.dp ?? null, volume: null, asOf: validTime(data.t) }];
  }

  async cryptoQuotes(): Promise<SourceQuote[]> {
    const params = new URLSearchParams({ ids: Object.values(COIN_IDS).join(','), vs_currencies: 'usd', include_24hr_change: 'true', include_24hr_vol: 'true', include_last_updated_at: 'true' });
    const raw = await fetchJson(this.fetcher, `https://api.coingecko.com/api/v3/simple/price?${params}`, z.record(z.string(), z.unknown()), this.coinHeaders());
    const quotes: SourceQuote[] = [];
    for (const [symbol, id] of Object.entries(COIN_IDS)) {
      const parsed = cryptoQuoteSchema.safeParse(raw[id]);
      if (!parsed.success) continue;
      const data = parsed.data;
      const changePercent = data.usd_24h_change ?? null;
      const previous = changePercent !== null && changePercent > -100 ? data.usd / (1 + changePercent / 100) : null;
      quotes.push({ symbol, price: data.usd, change: previous !== null ? data.usd - previous : null, changePercent,
        // CoinGecko reports 24-hour notional volume in USD (not units of the coin).
        volume: data.usd_24h_vol ?? null, asOf: validTime(data.last_updated_at) });
    }
    if (!quotes.length) throw new Error('Provider returned no valid cryptocurrency prices');
    return quotes;
  }

  async forexQuote(): Promise<SourceQuote[]> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
      const historySchema = z.object({
        amount: z.number(),
        base: z.string(),
        rates: z.record(z.string(), z.record(z.string(), z.number())),
      });
      const data = await fetchJson(this.fetcher, `https://api.frankfurter.dev/v1/${sevenDaysAgo}..?from=USD&to=INR`, historySchema);
      const dates = Object.keys(data.rates).sort();
      if (dates.length >= 2) {
        const lastDate = dates[dates.length - 1];
        const prevDate = dates[dates.length - 2];
        const current = data.rates[lastDate]?.INR;
        const prev = data.rates[prevDate]?.INR;
        if (current && prev) {
          const change = +(current - prev).toFixed(4);
          const changePercent = +((change / prev) * 100).toFixed(2);
          return [{ symbol: 'USD/INR', price: current, change, changePercent, volume: null, asOf: validTime(lastDate) }];
        }
      }
    } catch {
      // Graceful fallback to simple rate endpoint if range fails
    }
    const data = await fetchJson(this.fetcher, 'https://api.frankfurter.dev/v2/rate/USD/INR', fxSchema);
    return [{ symbol: 'USD/INR', price: data.rate, change: null, changePercent: null, volume: null, asOf: validTime(data.date) }];
  }

  async metalQuote(symbol: string): Promise<SourceQuote[]> {
    if (this.env.GOLD_API_KEY) {
      const schema = z.object({ price: positive, timestamp: positive, metal: z.string(), currency: z.literal('USD'),
        change: optionalNumber, change_percent: optionalNumber, ch: optionalNumber, chp: optionalNumber });
      const data = await fetchJson(this.fetcher, `https://www.goldapi.io/api/price/${symbol}/USD`, schema, { 'x-access-token': this.env.GOLD_API_KEY });
      if (data.metal !== symbol) throw new Error('Provider returned a different metal');
      return [{ symbol, price: data.price, change: data.change ?? data.ch ?? null, changePercent: data.change_percent ?? data.chp ?? null, volume: null, asOf: validTime(data.timestamp) }];
    }
    const schema = z.object({ price: positive, symbol: z.string(), currency: z.literal('USD'), updatedAt: dateString });
    const data = await fetchJson(this.fetcher, `https://api.gold-api.com/price/${symbol}`, schema);
    if (data.symbol !== symbol) throw new Error('Provider returned a different metal');
    let change: number | null = null;
    let changePercent: number | null = null;
    if (symbol === 'XAU') {
      try {
        const binanceSchema = z.object({ priceChange: z.string(), priceChangePercent: z.string() });
        const paxg = await fetchJson(this.fetcher, 'https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', binanceSchema);
        const cp = parseFloat(paxg.priceChangePercent);
        const ch = parseFloat(paxg.priceChange);
        if (Number.isFinite(cp)) changePercent = +cp.toFixed(2);
        if (Number.isFinite(ch)) change = +ch.toFixed(2);
      } catch {
        // Fallback without 24h change
      }
    }
    return [{ symbol, price: data.price, change, changePercent, volume: null, asOf: validTime(data.updatedAt) }];
  }

  async indiaInstruments(): Promise<Map<string, string>> {
    this.upstoxHeaders();
    const result = await this.instruments.get('india', DAY, 7 * DAY, async () => {
      const directory = new Map<string, string>();
      const results = await Promise.allSettled(['NSE', 'BSE'].map(async (exchange) => {
        const bytes = await fetchBytes(this.fetcher, `https://assets.upstox.com/market-quote/instruments/exchange/${exchange}.json.gz`, {}, 20_000_000);
        let parsed: unknown;
        try {
          // fetch may already decompress Content-Encoding: gzip; .gz downloads normally remain compressed.
          const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: 100_000_000 }) : bytes;
          parsed = JSON.parse(new TextDecoder().decode(decoded));
        } catch { throw new Error('Provider instrument directory is invalid'); }
        if (!Array.isArray(parsed)) throw new Error('Provider instrument directory is invalid');
        for (const item of parsed) {
          const result = instrumentSchema.safeParse(item);
          if (!result.success) continue;
          const entry = result.data;
          if (entry.segment === 'NSE_EQ' && entry.instrument_type === 'EQ' && ASSETS.some((asset) => asset.category === 'india' && asset.symbol === entry.trading_symbol)) {
            directory.set(entry.trading_symbol, entry.instrument_key);
          }
          if (entry.segment === 'BSE_EQ' && ASSETS.some(asset => asset.symbol === `${entry.trading_symbol}.BSE`)) directory.set(`${entry.trading_symbol}.BSE`, entry.instrument_key);
          for (const [symbol, definition] of Object.entries(INDIA_INDICES)) {
            if (entry.segment === definition.segment && [entry.name, entry.trading_symbol].some((name) => name.toLowerCase() === definition.name.toLowerCase())) directory.set(symbol, entry.instrument_key);
          }
        }
      }));
      if (!directory.size) throw new Error('Provider instrument directory is unavailable');
      // A missing exchange leaves only that exchange's assets unavailable; never invent keys.
      for (const result of results) if (result.status === 'rejected' && directory.size === 0) throw result.reason;
      return directory;
    });
    return result.value;
  }

  async indiaQuotes(): Promise<SourceQuote[]> {
    const headers = this.upstoxHeaders();
    const instruments = await this.indiaInstruments();
    const raw = await fetchJson(this.fetcher, `https://api.upstox.com/v3/market-quote/quotes?instrument_key=${encodeURIComponent([...instruments.values()].join(','))}`,
      z.object({ status: z.literal('success'), data: z.record(z.string(), z.unknown()) }), headers);
    const byKey = new Map([...instruments].map(([symbol, key]) => [key, symbol]));
    const quotes: SourceQuote[] = [];
    for (const entry of Object.values(raw.data)) {
      const parsed = upstoxQuoteSchema.safeParse(entry);
      if (!parsed.success) continue;
      const data = parsed.data;
      const symbol = byKey.get(data.instrument_token);
      if (!symbol) continue;
      const previous = data.prev_close_price && data.prev_close_price > 0 ? data.prev_close_price : data.net_change != null ? data.last_price - data.net_change : null;
      const change = data.net_change ?? (previous !== null ? data.last_price - previous : null);
      const tradeTime = Number(data.last_trade_time);
      const asOf = tradeTime > 0 ? validTime(tradeTime, true) : data.timestamp ? validTime(data.timestamp) : null;
      if (!asOf) continue;
      quotes.push({ symbol, price: data.last_price, change, changePercent: previous && previous > 0 && change !== null ? change / previous * 100 : null,
        volume: data.volume ?? null, asOf });
    }
    if (!quotes.length) throw new Error('Provider returned no valid Indian quotes');
    return quotes;
  }

  async indiaSession(exchange: 'NSE' | 'BSE'): Promise<MarketSession> {
    if (!this.env.UPSTOX_ANALYTICS_TOKEN) return marketSession('india');
    try {
      const response = await this.sessions.get(exchange, 60_000, 0, async () => {
        const schema = z.object({ status: z.literal('success'), data: z.object({ exchange: z.string(), status: z.string(), last_updated: positive }) });
        const data = await fetchJson(this.fetcher, `https://api.upstox.com/v2/market/status/${exchange}`, schema, this.upstoxHeaders());
        const states: Record<string, MarketSession['state']> = {
          NORMAL_OPEN: 'OPEN', NORMAL_CLOSE: 'CLOSED', PRE_OPEN_START: 'PRE-MARKET', PRE_OPEN_END: 'PRE-MARKET',
          CLOSING_START: 'AFTER-HOURS', CLOSING_END: 'CLOSED',
        };
        return { state: states[data.data.status] ?? 'UNKNOWN', timezone: 'Asia/Kolkata', note: `${exchange} exchange status reported by Upstox (${data.data.status}); checked ${new Date().toISOString()}` };
      });
      return response.value;
    } catch { return marketSession('india'); }
  }

  async news(): Promise<NewsArticle[]> {
    const schema = z.array(z.unknown());
    const articleSchema = z.object({ id: z.union([z.string(), finite]), headline: z.string().min(1), source: z.string().min(1),
      url: z.string().url().refine((url) => /^https?:\/\//i.test(url)), datetime: positive, summary: z.string().optional(), related: z.string().optional() });
    const raw = await fetchJson(this.fetcher, 'https://finnhub.io/api/v1/news?category=general', schema, this.finnhubHeaders());
    const articles: NewsArticle[] = [];
    for (const entry of raw) {
      const parsed = articleSchema.safeParse(entry);
      if (!parsed.success) continue;
      const item = parsed.data;
      try {
        articles.push({ id: String(item.id), headline: item.headline, source: item.source, url: item.url,
          publishedAt: validTime(item.datetime), summary: item.summary ?? '', relatedAssets: item.related?.split(',').map((value) => value.trim()).filter(Boolean) ?? [] });
      } catch { /* Drop malformed dates without discarding other articles. */ }
    }
    if (raw.length && !articles.length) throw new Error('Provider returned no valid news articles');
    return [...new Map(articles.map((item) => [item.id, enrichNews(item, 'global')])).values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
  }

  indiaNews() { return indianMarketNews(this.fetcher); }

  async history(asset: Asset, range: HistoryRange): Promise<PricePoint[]> {
    const days = RANGE_DAYS[range];
    if (asset.category === 'crypto') {
      const schema = z.object({ prices: z.array(z.tuple([positive, positive])) });
      const data = await fetchJson(this.fetcher, `https://api.coingecko.com/api/v3/coins/${COIN_IDS[asset.symbol]}/market_chart?vs_currency=usd&days=${days}`, schema, this.coinHeaders());
      return ensurePoints(data.prices.map(([timestamp, price]) => ({ time: validTime(timestamp, true), price })));
    }
    if (asset.category === 'forex') {
      if (range === '1D') throw new Error('Frankfurter publishes daily reference rates; intraday charts are unavailable');
      const from = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
      const data = await fetchJson(this.fetcher, `https://api.frankfurter.dev/v2/rates?base=USD&quotes=INR&from=${from}`, z.array(fxSchema));
      return ensurePoints(data.map((point) => ({ time: validTime(point.date), price: point.rate })));
    }
    if (asset.category === 'us') {
      const to = Math.floor(Date.now() / 1_000);
      const resolution = range === '1D' ? '5' : range === '5D' ? '60' : 'D';
      const schema = z.object({ s: z.enum(['ok', 'no_data']), c: z.array(positive).optional(), t: z.array(positive).optional() });
      const data = await fetchJson(this.fetcher, `https://finnhub.io/api/v1/stock/candle?symbol=${asset.symbol}&resolution=${resolution}&from=${to - days * 86400}&to=${to}`, schema, this.finnhubHeaders());
      if (data.s !== 'ok' || !data.c?.length || data.c.length !== data.t?.length) throw new Error('Provider historical data is unavailable for this symbol/range or requires a plan entitlement');
      return ensurePoints(data.c.map((price, index) => ({ time: validTime(data.t![index]), price })));
    }
    if (asset.category === 'india') {
      const headers = this.upstoxHeaders();
      const key = (await this.indiaInstruments()).get(asset.symbol);
      if (!key) throw new Error('Instrument was not found in the provider directory; the symbol may have changed');
      const encoded = encodeURIComponent(key);
      const today = zonedClock(new Date(), 'Asia/Kolkata').date;
      const from = zonedClock(new Date(Date.now() - days * DAY), 'Asia/Kolkata').date;
      if (range === '1D') {
        const data = await fetchJson(this.fetcher, `https://api.upstox.com/v3/historical-candle/intraday/${encoded}/minutes/5`, indiaHistorySchema, headers);
        return ensurePoints(data.data.candles.map((point) => ({ time: validTime(point[0]), price: point[4] })));
      }
      const interval = range === '5D' ? 'minutes/30' : 'days/1';
      const data = await fetchJson(this.fetcher, `https://api.upstox.com/v3/historical-candle/${encoded}/${interval}/${today}/${from}`, indiaHistorySchema, headers);
      return ensurePoints(data.data.candles.map((point) => ({ time: validTime(point[0]), price: point[4] })));
    }
    throw new Error('Metals history is unavailable in this integration; no chart is fabricated from spot quotes');
  }

  async candles(asset: Asset, interval: '5m' | '30m' | '1d', range: HistoryRange): Promise<Candle[]> {
    if (!['india', 'us'].includes(asset.category)) throw new Error('OHLCV candles are supported for Indian and US equities only. Price-only series are not converted to candles.');
    const days = RANGE_DAYS[range];
    if (interval !== '1d' && days > 30) throw new Error('Intraday chart ranges are limited to one month. Select daily candles for longer ranges.');
    let candles: Candle[];
    if (asset.category === 'india') {
      const key = (await this.indiaInstruments()).get(asset.symbol);
      if (!key) throw new Error('Instrument is unavailable in the current provider directory.');
      const encoded = encodeURIComponent(key);
      const unit = interval === '1d' ? 'days/1' : `minutes/${interval === '5m' ? 5 : 30}`;
      const today = zonedClock(new Date(), 'Asia/Kolkata').date;
      const from = zonedClock(new Date(Date.now() - days * DAY), 'Asia/Kolkata').date;
      const url = range === '1D' && interval !== '1d'
        ? `https://api.upstox.com/v3/historical-candle/intraday/${encoded}/${unit}`
        : `https://api.upstox.com/v3/historical-candle/${encoded}/${unit}/${today}/${from}`;
      const data = await fetchJson(this.fetcher, url, indiaHistorySchema, this.upstoxHeaders());
      candles = data.data.candles.map(p => ({ time: validTime(p[0]), open: p[1], high: p[2], low: p[3], close: p[4], volume: p[5] ?? null }));
    } else {
      const to = Math.floor(Date.now() / 1000);
      const schema = z.object({ s: z.string(), t: z.array(positive).default([]), o: z.array(positive).default([]), h: z.array(positive).default([]), l: z.array(positive).default([]), c: z.array(positive).default([]), v: z.array(z.number().nonnegative()).default([]) });
      const data = await fetchJson(this.fetcher, `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(asset.symbol)}&resolution=${interval === '1d' ? 'D' : interval === '5m' ? '5' : '30'}&from=${to - days * 86400}&to=${to}`, schema, this.finnhubHeaders());
      if (data.s !== 'ok' || ![data.o, data.h, data.l, data.c, data.v].every(values => values.length === data.t.length)) throw new Error('OHLCV data is unavailable or requires provider entitlement.');
      candles = data.t.map((t, i) => ({ time: validTime(t), open: data.o[i], high: data.h[i], low: data.l[i], close: data.c[i], volume: data.v[i] }));
    }
    if (!candles.length) throw new Error('No candles are available for this session and interval.');
    const valid = z.array(fullCandleSchema).max(15000).parse(candles);
    return [...new Map(valid.map(c => [c.time, c])).values()].sort((a, b) => a.time.localeCompare(b.time));
  }
}
