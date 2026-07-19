import React, { useState, useEffect } from 'react';
import { Globe, Settings, Search, SunMoon, ShieldAlert, Cpu, LayoutDashboard, Coins, Newspaper, TrendingUp } from 'lucide-react';
import { ThemeType, ThemeColors } from '../types/market';
import { THEMES } from '../utils/themes';

interface HeaderProps {
  currentTheme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colors: ThemeColors;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  lastUpdated: Date;
  activeTab: 'overview' | 'equities' | 'commodities' | 'crypto' | 'news';
  setActiveTab: (tab: 'overview' | 'equities' | 'commodities' | 'crypto' | 'news') => void;
}

export default function Header({
  currentTheme,
  setTheme,
  colors,
  searchTerm,
  setSearchTerm,
  isSettingsOpen,
  toggleSettings,
  lastUpdated,
  activeTab,
  setActiveTab
}: HeaderProps) {
  const [clocks, setClocks] = useState({
    est: '',
    ist: ''
  });

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      
      const formatOptions = (timeZone: string) => {
        return now.toLocaleTimeString('en-US', {
          timeZone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      };

      setClocks({
        est: formatOptions('America/New_York') + ' EST',
        ist: formatOptions('Asia/Kolkata') + ' IST'
      });
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className={`sticky top-0 z-50 border-b ${colors.border} bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 backdrop-blur-xl transition-all duration-300 shadow-lg shadow-indigo-500/5`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row justify-between items-center gap-4">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-500/10 animate-pulse">
            <Globe className={`w-7 h-7 ${colors.accent}`} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent flex items-center gap-2">
              GLOBAL MARKETS COMMAND CENTER
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Terminal
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Middle: Live Clocks */}
        <div className="hidden xl:flex items-center gap-4 bg-gradient-to-r from-slate-900/80 to-slate-800/80 px-5 py-2.5 rounded-full border border-slate-700/50 shadow-lg">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">New York</div>
            <div className="text-sm font-mono font-bold text-slate-300">{clocks.est}</div>
          </div>
          <div className="h-6 w-[1px] bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Mumbai</div>
            <div className="text-sm font-mono font-bold text-indigo-400">{clocks.ist}</div>
          </div>
        </div>

        {/* Right: Actions, Search & Customizations */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          
          {/* Universal Symbol Search */}
          <div className="relative w-full sm:w-48 lg:w-64 flex-shrink-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search symbols..."
              className="w-full bg-slate-900/80 border border-slate-700/50 hover:border-indigo-500/50 focus:border-indigo-500 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none transition-all duration-300 font-mono placeholder:text-slate-500 shadow-inner"
            />
          </div>

          {/* Theme Selector */}
          <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-slate-900/80 to-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2 shadow-lg flex-shrink-0">
            <SunMoon className="w-4 h-4 text-indigo-400" />
            <select
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value as ThemeType)}
              className="bg-transparent border-none text-sm focus:ring-0 font-medium text-slate-300 outline-none cursor-pointer"
            >
              {Object.entries(THEMES).map(([key, value]) => (
                <option key={key} value={key} className="bg-slate-950 text-slate-300">
                  {value.name}
                </option>
              ))}
            </select>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={toggleSettings}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all duration-300 shadow-lg flex-shrink-0 ${
              isSettingsOpen
                ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/40 text-indigo-400 shadow-indigo-500/10'
                : 'bg-slate-900/80 border-slate-700/50 hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
            title="Configure API Connections"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dynamic Tab Navigation */}
      <nav className="bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-slate-950/80 border-t border-slate-800/50 px-4 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto flex gap-2 md:gap-6 py-3 min-w-max md:justify-center">
          
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10'
                : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Command Cockpit</span>
          </button>

          <button
            onClick={() => setActiveTab('equities')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'equities'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10'
                : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Global Equities</span>
          </button>

          <button
            onClick={() => setActiveTab('commodities')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'commodities'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10'
                : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Spot Commodities</span>
          </button>

          <button
            onClick={() => setActiveTab('crypto')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'crypto'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10'
                : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Digital Assets</span>
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'news'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10'
                : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>AI Signals & News</span>
          </button>

        </div>
      </nav>
    </header>
  );
}
