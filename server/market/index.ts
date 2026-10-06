import { ASSETS, ASSET_BY_SYMBOL, HISTORY_RANGES } from '../../shared/assets';
import type { Asset, AssetCategory, DataStatus, HistoryRange, HistoryResponse, MarketSession, NewsArticle, NewsResponse, Overview, ProviderStatus, Quote } from '../../shared/types';
import { DataCache, type CachedValue } from './cache';
import { MarketProviders, type MarketEnvironment, type PricePoint, type SourceQuote } from './providers';
import { UpstoxWebSocketClient } from './websocket';
import { marketSession } from './sessions';
import type { Fetcher } from './http';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Provider request failed';

export function quoteFreshness(asset: Asset, asOf: string, session: MarketSession, now = Date.now()): DataStatus {
  const age = now - Date.parse(asOf);
  if (asset.category === 'forex') return age > 7 * DAY ? 'stale' : 'delayed';
  if ((asset.category === 'us' || asset.category === 'india') && session.state !== 'OPEN') return age > 7 * DAY ? 'stale' : 'delayed';
  if (age > 15 * 60_000) return 'stale';
  if (age > 2 * 60_000) return 'delayed';
  return 'live';
}

export class MarketService {
  private quotesCache = new DataCache<SourceQuote[]>();
  private newsCache = new DataCache<NewsArticle[]>();
  private historyCache = new DataCache<PricePoint[]>();
  private observed = new Map<string, { status: string; message: string }>();
  private providers: MarketProviders;
  private upstoxWs: UpstoxWebSocketClient;

  constructor(env: MarketEnvironment = process.env, fetcher: Fetcher = fetch) {
    this.providers = new MarketProviders(env, fetcher);
    this.upstoxWs = new UpstoxWebSocketClient(env.UPSTOX_ANALYTICS_TOKEN);
    if (env.UPSTOX_ANALYTICS_TOKEN) {
      void this.upstoxWs.start();
    }
  }

  private providerFor(asset: Asset): string {
    return ({ us: 'finnhub', india: 'upstox', crypto: 'coingecko', commodities: this.providers.metalsProvider, forex: 'frankfurter' })[asset.category];
  }

  private unavailable(asset: Asset, error: string): Quote {
    return { ...asset, price: null, change: null, changePercent: null, volume: null, asOf: null,
      provider: this.providerFor(asset), status: 'unavailable', fetchedAt: null, cached: false, error, session: marketSession(asset.category) };
  }

  private hydrate(asset: Asset, raw: SourceQuote, meta: CachedValue<SourceQuote[]>, session: MarketSession): Quote {
    const sourceStatus = quoteFreshness(asset, raw.asOf, session);
    const status = meta.stale || sourceStatus === 'stale' ? 'stale' : meta.cached && sourceStatus === 'live' ? 'cached' : sourceStatus;
    return { ...asset, ...raw, provider: this.providerFor(asset), status, fetchedAt: meta.fetchedAt, cached: meta.cached, session,
      ...(meta.error ? { error: meta.error } : {}) };
  }

  async overview(category?: AssetCategory): Promise<Overview> {
    const assets = ASSETS.filter((asset) => !category || asset.category === category);
    const usTtl = marketSession('us').state === 'CLOSED' ? 30 * 60_000 : 60_000;
    const indiaTtl = marketSession('india').state === 'CLOSED' ? 30 * 60_000 : 60_000;
    const groups: { key: string; assets: Asset[]; ttl: number; staleFor: number; load: () => Promise<SourceQuote[]> }[] = [];
    for (const asset of assets.filter((item) => item.category === 'us')) groups.push({ key: `us:${asset.symbol}`, assets: [asset], ttl: usTtl, staleFor: 3 * DAY, load: () => this.providers.usQuote(asset.symbol) });
    for (const asset of assets.filter((item) => item.category === 'commodities')) groups.push({ key: `metals:${asset.symbol}`, assets: [asset], ttl: this.providers.metalTtl, staleFor: DAY, load: () => this.providers.metalQuote(asset.symbol) });
    if (assets.some((asset) => asset.category === 'crypto')) groups.push({ key: 'crypto', assets: assets.filter((asset) => asset.category === 'crypto'), ttl: 60_000, staleFor: HOUR, load: () => this.providers.cryptoQuotes() });
    if (assets.some((asset) => asset.category === 'forex')) groups.push({ key: 'forex', assets: assets.filter((asset) => asset.category === 'forex'), ttl: 6 * HOUR, staleFor: 7 * DAY, load: () => this.providers.forexQuote() });
    if (assets.some((asset) => asset.category === 'india')) groups.push({ key: 'india', assets: assets.filter((asset) => asset.category === 'india'), ttl: indiaTtl, staleFor: 3 * DAY, load: () => this.providers.indiaQuotes() });
    const indiaSessions = assets.some((asset) => asset.category === 'india')
      ? Promise.all([this.providers.indiaSession('NSE'), this.providers.indiaSession('BSE')])
      : Promise.resolve([] as MarketSession[]);
    const results = await Promise.allSettled(groups.map((group) => this.quotesCache.get(group.key, group.ttl, group.staleFor, group.load)));
    const [nse, bse] = await indiaSessions;
    const bySymbol = new Map<string, Quote>();
    groups.forEach((group, index) => {
      const result = results[index];
      for (const asset of group.assets) {
        const session = asset.category === 'india' ? (asset.symbol === 'SENSEX' ? bse : nse) ?? marketSession('india') : marketSession(asset.category);
        if (result.status === 'rejected') {
          bySymbol.set(asset.symbol, { ...this.unavailable(asset, errorMessage(result.reason)), session });
          continue;
        }
        const raw = result.value.value.find((quote) => quote.symbol === asset.symbol);
        bySymbol.set(asset.symbol, raw ? this.hydrate(asset, raw, result.value, session)
          : { ...this.unavailable(asset, 'Provider returned no valid quote or current instrument mapping for this symbol'), session });
      }
    });
    const quotes = assets.map((asset) => bySymbol.get(asset.symbol)!);
    for (const provider of new Set(quotes.map((quote) => quote.provider))) {
      const subset = quotes.filter((quote) => quote.provider === provider);
      const failures = subset.filter((quote) => quote.error || quote.status === 'unavailable' || quote.status === 'stale');
      this.observed.set(provider, failures.length
        ? { status: failures.length === subset.length ? 'unavailable' : 'partial', message: failures[0].error ?? 'Provider source timestamps are stale' }
        : { status: 'connected', message: `Validated provider response; latest check ${new Date().toISOString()}` });
    }
    return { quotes, generatedAt: new Date().toISOString() };
  }

  async news(): Promise<NewsResponse> {
    try {
      const response = await this.newsCache.get('news', 5 * 60_000, 6 * HOUR, () => this.providers.news());
      return { articles: response.value, provider: 'finnhub', status: response.stale ? 'stale' : response.cached ? 'cached' : 'live',
        fetchedAt: response.fetchedAt, cached: response.cached, ...(response.error ? { error: response.error } : {}) };
    } catch (error) {
      return { articles: [], provider: 'finnhub', status: 'unavailable', fetchedAt: null, cached: false, error: errorMessage(error) };
    }
  }

  async history(symbol: string, range: HistoryRange): Promise<HistoryResponse> {
    const asset = ASSET_BY_SYMBOL.get(symbol);
    if (!asset || !HISTORY_RANGES.includes(range)) throw new Error('Unknown asset or unsupported history range');
    try {
      const response = await this.historyCache.get(`${symbol}:${range}`, range === '1D' ? 5 * 60_000 : HOUR, DAY, () => this.providers.history(asset, range));
      return { symbol, range, currency: asset.currency, points: response.value, provider: this.providerFor(asset),
        status: response.stale ? 'stale' : response.cached ? 'cached' : 'delayed', fetchedAt: response.fetchedAt, cached: response.cached,
        ...(response.error ? { error: response.error } : {}) };
    } catch (error) {
      return { symbol, range, currency: asset.currency, points: [], provider: this.providerFor(asset), status: 'unavailable', fetchedAt: null, cached: false, error: errorMessage(error) };
    }
  }

  providerStatuses(): ProviderStatus[] {
    const env = this.providers.env;
    const wsStatus = this.upstoxWs.getStatus();
    const definitions = [
      { id: 'finnhub', name: 'Finnhub · US equities and news', configured: !!env.FINNHUB_API_KEY, message: 'Set FINNHUB_API_KEY; a free personal-use tier is available. History depends on plan entitlement.' },
      { id: 'upstox', name: 'Upstox · Indian equities and indices', configured: !!env.UPSTOX_ANALYTICS_TOKEN, message: 'Set UPSTOX_ANALYTICS_TOKEN using the free read-only Analytics Token from Upstox Developer Apps.' },
      { id: 'upstox-ws', name: 'Upstox · Real-Time WebSocket Feed', configured: !!env.UPSTOX_ANALYTICS_TOKEN, message: wsStatus.message },
      { id: 'coingecko', name: 'CoinGecko · Cryptocurrency', configured: true, message: env.COINGECKO_DEMO_API_KEY ? 'Demo API credential configured; connection has not been checked.' : 'Public API enabled; optional COINGECKO_DEMO_API_KEY improves quota predictability.' },
      { id: this.providers.metalsProvider, name: env.GOLD_API_KEY ? 'GoldAPI.io · Metals' : 'Gold-API.com · Metals', configured: true, message: env.GOLD_API_KEY ? 'GoldAPI credential configured; daily cache protects its limited free quota.' : 'Public no-key spot API enabled; daily change, volume and historical charts are unavailable.' },
      { id: 'frankfurter', name: 'Frankfurter · USD/INR', configured: true, message: 'Public API enabled; daily reference exchange rates, not live FX prices.' },
    ];
    return definitions.map((definition) => {
      const isUpstox = definition.id === 'upstox' || definition.id === 'upstox-ws';
      const statusValue = definition.id === 'upstox-ws' && definition.configured ? wsStatus.status : definition.configured ? 'configured' : isUpstox ? 'UNCONFIGURED' : 'missing-key';
      return {
        ...definition,
        status: statusValue,
        ...(definition.configured && definition.id !== 'upstox-ws' ? this.observed.get(definition.id) : {})
      };
    });
  }
}

export const marketService = new MarketService();
export { marketSession } from './sessions';
