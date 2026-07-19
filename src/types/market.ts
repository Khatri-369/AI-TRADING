export type ThemeType = 'midnight' | 'cyberpunk' | 'emerald' | 'terminal' | 'ocean';

export interface ThemeColors {
  name: string;
  bg: string;
  border: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  positiveBg: string;
  positiveText: string;
  negativeBg: string;
  negativeText: string;
  neutralBg: string;
  neutralText: string;
  fontFamily: string;
  glow: string;
}

export interface LivePrice {
  symbol: string;
  name: string;
  priceUSD: number;
  priceINR: number;
  changePercent: number;
  lastUpdated: Date;
  status: 'live' | 'simulated' | 'loading' | 'error';
  isGaining?: boolean;
  high?: number;
  low?: number;
  volume?: number;
}

export interface AISignal {
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  signal: 'Buy' | 'Sell' | 'Hold';
  confidence: number;
  rationale: string;
  affected_assets: string[];
  timestamp: Date;
  probabilities?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  engine?: 'finbert' | 'gemini';
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  datetime: Date;
  region: string;
  affected_assets: string[];
  analysis?: AISignal;
  isAnalyzing?: boolean;
}

export interface DealFlow {
  id: string;
  from: string;
  to: string;
  asset: string;
  value: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  coords: {
    from: { x: number; y: number };
    to: { x: number; y: number };
  };
}

export interface CountryData {
  name: string;
  code: string;
  netCommodityFlow: string;
  btcTrend: 'up' | 'down' | 'flat';
  buyerSellerStatus: 'buyer' | 'seller' | 'neutral';
  recentNews: string[];
}
