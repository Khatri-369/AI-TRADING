import React from 'react';
import { Key, RefreshCw, Radio, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ThemeColors } from '../types/market';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  finnhubKey: string;
  setFinnhubKey: (key: string) => void;
  goldApiKey: string;
  setGoldApiKey: (key: string) => void;
  colors: ThemeColors;
  stats: {
    crypto: 'live' | 'simulated' | 'loading' | 'error';
    usStocks: 'live' | 'simulated' | 'loading' | 'error';
    commodities: 'live' | 'simulated' | 'loading' | 'error';
    news: 'live' | 'simulated' | 'loading' | 'error';
    indianEquity: 'disconnected';
    gemini: 'active' | 'demo' | 'error';
  };
}

export default function SettingsPanel({
  isOpen,
  onClose,
  finnhubKey,
  setFinnhubKey,
  goldApiKey,
  setGoldApiKey,
  colors,
  stats
}: SettingsPanelProps) {
  if (!isOpen) return null;

  const renderStatus = (status: string) => {
    switch (status) {
      case 'live':
      case 'active':
        return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        );
      case 'demo':
      case 'simulated':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Simulated
          </span>
        );
      case 'disconnected':
        return (
          <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Disconnected
          </span>
        );
      case 'loading':
        return (
          <span className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" /> Fetching
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Error
          </span>
        );
    }
  };

  return (
    <div className={`p-8 mb-8 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300 shadow-xl ${colors.glow}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800/50">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Key className={`w-6 h-6 ${colors.textPrimary}`} />
            API & Data Connection Settings
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Configure external API keys to transition from simulated market feeds to authentic live data.
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          Collapse Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Key inputs */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Finnhub.io API Key (Free at{' '}
              <a href="https://finnhub.io/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                finnhub.io
              </a>
              )
            </label>
            <div className="relative">
              <input
                type="password"
                value={finnhubKey}
                onChange={(e) => setFinnhubKey(e.target.value)}
                placeholder="Paste Finnhub API Key (e.g. cn9q861r01..."
                className="w-full bg-slate-950/80 border border-slate-700/50 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-indigo-500 font-mono transition-all duration-300 shadow-inner"
              />
              <Key className="absolute right-4 top-3.5 w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Enables live prices for S&P 500, Nasdaq 100 constituents (AAPL, MSFT, NVDA, etc.), Forex, and Market News.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              GoldAPI.io Access Token (Free at{' '}
              <a href="https://www.goldapi.io/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                goldapi.io
              </a>
              )
            </label>
            <div className="relative">
              <input
                type="password"
                value={goldApiKey}
                onChange={(e) => setGoldApiKey(e.target.value)}
                placeholder="Paste GoldAPI Token (e.g. goldapi-10p02..."
                className="w-full bg-slate-950/80 border border-slate-700/50 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-indigo-500 font-mono transition-all duration-300 shadow-inner"
              />
              <Key className="absolute right-4 top-3.5 w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Powers real spot prices for Gold (XAU) and Silver (XAG) in USD/oz and dynamic INR conversions.
            </p>
          </div>
        </div>

        {/* Right column: Active Feed Status */}
        <div className="bg-slate-950/60 p-6 rounded-xl border border-slate-800/80 shadow-lg">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-400" /> Live Data Synchronization Status
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-base border-b border-slate-900/50 pb-3">
              <span className="text-slate-400">Crypto (CoinGecko API)</span>
              {renderStatus(stats.crypto)}
            </div>
            <div className="flex justify-between items-center text-base border-b border-slate-900/50 pb-3">
              <span className="text-slate-400">US Equities (Finnhub)</span>
              {renderStatus(stats.usStocks)}
            </div>
            <div className="flex justify-between items-center text-base border-b border-slate-900/50 pb-3">
              <span className="text-slate-400">Commodities (GoldAPI)</span>
              {renderStatus(stats.commodities)}
            </div>
            <div className="flex justify-between items-center text-base border-b border-slate-900/50 pb-3">
              <span className="text-slate-400">Global News (Finnhub)</span>
              {renderStatus(stats.news)}
            </div>
            <div className="flex justify-between items-center text-base border-b border-slate-900/50 pb-3">
              <span className="text-slate-400">Indian Equities (Nifty)</span>
              {renderStatus(stats.indianEquity)}
            </div>
            <div className="flex justify-between items-center text-base pb-2">
              <span className="text-slate-400">Gemini Signal Agent</span>
              {renderStatus(stats.gemini)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-slate-900/40 to-slate-800/40 rounded-xl border border-slate-800/50 flex items-start gap-4 shadow-lg">
        <CheckCircle2 className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Security Guarantee:</strong> Keys are kept purely in React's component state. They are never written to disk, committed to code repositories, or stored in local storage, adhering to enterprise cloud-key privacy parameters.
        </div>
      </div>
    </div>
  );
}
