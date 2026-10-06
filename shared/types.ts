export type AssetCategory = 'us' | 'india' | 'crypto' | 'commodities' | 'forex';
export type DataStatus = 'live' | 'delayed' | 'cached' | 'stale' | 'unavailable';
export type HistoryRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y';

export interface Asset {
  symbol: string;
  name: string;
  category: AssetCategory;
  currency: string;
  sector?: string;
}

export interface MarketSession {
  state: 'OPEN' | 'CLOSED' | 'PRE-MARKET' | 'AFTER-HOURS' | 'UNKNOWN';
  timezone: string;
  note?: string;
}

export interface Quote extends Asset {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  asOf: string | null;
  provider: string;
  status: DataStatus;
  fetchedAt: string | null;
  cached: boolean;
  error?: string;
  session: MarketSession;
}

export interface Overview {
  quotes: Quote[];
  generatedAt: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
  relatedAssets: string[];
}

export interface NewsResponse {
  articles: NewsArticle[];
  provider: string;
  status: DataStatus;
  fetchedAt: string | null;
  cached: boolean;
  error?: string;
}

export interface HistoryResponse {
  symbol: string;
  range: HistoryRange;
  currency: string;
  points: { time: string; price: number }[];
  provider: string;
  status: DataStatus;
  fetchedAt: string | null;
  cached: boolean;
  error?: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  status: string;
  message: string;
}
