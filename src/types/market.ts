export type { Asset, Quote, MarketSession, Overview, NewsArticle, NewsResponse, HistoryResponse, ProviderStatus } from '../../shared/types';

export type ThemeType = 'light' | 'dark';
export type Tab = 'overview' | 'markets' | 'news' | 'diagnostics' | 'watchlist' | 'desk';
export type Engine = 'gemini' | 'finbert';
export type HistoryRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y';

export interface AIAnalysis {
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  signal: 'Buy' | 'Sell' | 'Hold';
  confidence: number;
  rationale: string;
  risks: string[];
  affectedAssets: string[];
  engine: string;
  engineStatus: 'available';
  generatedAt: string;
  cached: boolean;
}

export interface AnalysisEntry {
  title: string;
  result?: AIAnalysis;
  loading: boolean;
  error?: string;
}
