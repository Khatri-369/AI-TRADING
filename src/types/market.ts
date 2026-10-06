export type { Asset, Quote, MarketSession, Overview, NewsArticle, NewsResponse, HistoryResponse, ProviderStatus } from '../../shared/types';

export type ThemeType = 'midnight' | 'cyberpunk' | 'emerald' | 'terminal' | 'ocean';
export type ThemeColors = {
  name: string; bg: string; border: string; cardBg: string; textPrimary: string;
  textSecondary: string; accent: string; positiveBg: string; positiveText: string;
  negativeBg: string; negativeText: string; neutralBg: string; neutralText: string;
  fontFamily: string; glow: string;
};
export type Tab = 'overview' | 'equities' | 'commodities' | 'crypto' | 'news';
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
export interface ScenarioResult {
  scenario: string;
  summary: string;
  impacts: Array<{ symbol: string; direction: 'up' | 'down' | 'mixed'; estimatedChangePercent: number | null; rationale: string }>;
  risks: string[];
  engine: string;
  engineStatus: 'available';
  generatedAt: string;
  hypothetical: true;
  cached: boolean;
}
export interface AnalysisEntry { title: string; result?: AIAnalysis; loading: boolean; error?: string }
