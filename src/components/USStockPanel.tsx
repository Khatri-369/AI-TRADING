import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, HelpCircle, Activity, ChevronDown, ChevronUp, AlertCircle, Cpu, RefreshCw } from 'lucide-react';
import { LivePrice, ThemeColors } from '../types/market';

interface USStockPanelProps {
  stocks: LivePrice[];
  colors: ThemeColors;
  apiKeyMissing: boolean;
  onAnalyze: (symbol: string) => void;
  isAnalyzing: Record<string, boolean>;
  analysisData: Record<string, any>;
}

export default function USStockPanel({
  stocks,
  colors,
  apiKeyMissing,
  onAnalyze,
  isAnalyzing,
  analysisData
}: USStockPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'gainers' | 'losers'>('all');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Determine current market hours in US (Eastern Time)
  const getMarketStatus = () => {
    const estTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const estDate = new Date(estTime);
    const hour = estDate.getHours();
    const day = estDate.getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      return { status: 'Closed', label: 'Weekend Closed', color: 'text-slate-500 bg-slate-900/60' };
    }
    if (hour >= 9 && hour < 16) {
      return { status: 'Regular', label: 'Regular Session', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
    if (hour >= 4 && hour < 9.5) {
      return { status: 'PreMarket', label: 'Pre-Market Session', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
    return { status: 'AfterHours', label: 'After-Hours Session', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' };
  };

  const marketStatus = getMarketStatus();

  // Filter stocks based on active tab
  const filteredStocks = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
  const displayedStocks = (() => {
    if (activeTab === 'gainers') {
      return filteredStocks.filter(s => s.changePercent > 0);
    }
    if (activeTab === 'losers') {
      return [...filteredStocks].reverse().filter(s => s.changePercent < 0);
    }
    return filteredStocks;
  })();

  const toggleRow = (symbol: string) => {
    setExpandedSymbol(expandedSymbol === symbol ? null : symbol);
  };

  // Generate mock sparkline coordinates for standard 30-day trend
  const getSparklinePath = (changePercent: number) => {
    const points = 15;
    const height = 40;
    const width = 120;
    const dataPoints: number[] = [];
    
    // Seed random path with general trend based on positive/negative changePercent
    let currentVal = height / 2;
    const step = width / (points - 1);
    
    for (let i = 0; i < points; i++) {
      const noise = (Math.random() - 0.5) * 12;
      const trend = (changePercent / 100) * (i / points) * 15;
      const nextVal = Math.min(Math.max(currentVal - noise - trend, 2), height - 2);
      dataPoints.push(nextVal);
    }

    return dataPoints.map((val, idx) => `${idx * step},${val}`).join(' L ');
  };

  return (
    <section id="us-stocks" className="scroll-mt-28 mb-8">
      <div className={`p-8 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300 shadow-xl ${colors.glow}`}>
        
        {/* Panel Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${marketStatus.status === 'Closed' ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'} shadow-lg shadow-emerald-500/30`} />
              <h2 className="text-2xl font-bold tracking-tight">US Tech Equities (S&P 500 Peers)</h2>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Top technology indices and companies traded on the US exchange. Real-time proxy feeds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Market hours label */}
            <span className={`text-sm px-4 py-2 font-semibold rounded-xl border ${marketStatus.color}`}>
              {marketStatus.label}
            </span>

            {/* Filter buttons */}
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-lg">
              {(['all', 'gainers', 'losers'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs uppercase font-bold tracking-wider px-4 py-2 rounded-lg transition-all duration-300 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider pb-3">
                <th className="py-4 px-5">Symbol</th>
                <th className="py-4 px-5">LTP</th>
                <th className="py-4 px-5">Change %</th>
                <th className="py-4 px-5 hidden sm:table-cell">High/Low</th>
                <th className="py-4 px-5 text-center">AI Rating</th>
                <th className="py-4 px-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {displayedStocks.map((stock) => {
                const isExpanded = expandedSymbol === stock.symbol;
                const isGaining = stock.changePercent >= 0;
                const signal = analysisData[stock.symbol] || null;

                return (
                  <React.Fragment key={stock.symbol}>
                    <tr
                      onClick={() => toggleRow(stock.symbol)}
                      className="hover:bg-slate-800/30 cursor-pointer transition-all duration-200 group"
                    >
                      {/* Symbol */}
                      <td className="py-4 px-5 font-bold">
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-8 rounded-full ${isGaining ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-rose-500 shadow-lg shadow-rose-500/30'}`} />
                          <div>
                            <span className="text-white font-semibold">{stock.symbol}</span>
                            <span className="text-xs text-slate-500 block font-normal">{stock.name}</span>
                          </div>
                        </div>
                      </td>
                      
                      {/* LTP */}
                      <td className="py-4 px-5 font-mono font-semibold text-slate-200">
                        ${stock.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Change % */}
                      <td className="py-4 px-5 font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            isGaining 
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                              : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          }`}
                        >
                          {isGaining ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </span>
                      </td>

                      {/* High/Low */}
                      <td className="py-4 px-5 font-mono text-xs text-slate-400 hidden sm:table-cell">
                        H: ${(stock.high || stock.priceUSD * 1.02).toFixed(2)} <br />
                        L: ${(stock.low || stock.priceUSD * 0.98).toFixed(2)}
                      </td>

                      {/* AI Signal Badge */}
                      <td className="py-4 px-5 text-center">
                        {signal ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-lg ${
                              signal.signal === 'Buy'
                                ? colors.positiveBg + ' ' + colors.positiveText
                                : signal.signal === 'Sell'
                                ? colors.negativeBg + ' ' + colors.negativeText
                                : colors.neutralBg + ' ' + colors.neutralText
                            }`}
                          >
                            <Cpu className="w-4 h-4" />
                            {signal.signal} ({signal.confidence}%)
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnalyze(stock.symbol);
                            }}
                            disabled={isAnalyzing[stock.symbol]}
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-400 hover:from-indigo-500/25 hover:to-purple-500/25 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-500/25 transition-all duration-300 shadow-lg"
                          >
                            {isAnalyzing[stock.symbol] ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Rating...
                              </>
                            ) : (
                              <>
                                <Cpu className="w-4 h-4" />
                                Run AI Signal
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Toggle */}
                      <td className="py-4 px-5 text-right">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400 inline-block group-hover:text-slate-200 transition-colors" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400 inline-block group-hover:text-slate-200 transition-colors" />
                        )}
                      </td>
                    </tr>

                    {/* Row Expansion */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-950/40 p-4 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            
                            {/* Trend Sparkline */}
                            <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                              <div className="text-xs text-slate-400 mb-2 font-bold flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                30-Day Historical Trend Sparkline
                              </div>
                              <div className="h-12 flex items-center justify-center">
                                <svg className="w-full h-full" viewBox="0 0 120 40">
                                  <path
                                    d={`M 0,${getSparklinePath(stock.changePercent)}`}
                                    fill="none"
                                    stroke={isGaining ? '#34d399' : '#f43f5e'}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </div>

                            {/* Gemini AI Summary */}
                            <div className="md:col-span-2 p-3.5 bg-indigo-950/10 border border-indigo-500/10 rounded-xl">
                              <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase mb-1.5">
                                <Cpu className="w-4 h-4" /> Gemini AI Rating Context
                              </h4>
                              {signal ? (
                                <div>
                                  <div className="text-sm font-semibold text-slate-100">{signal.sentiment} Market Outlook</div>
                                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                    {signal.rationale}
                                  </p>
                                  <div className="flex gap-2.5 mt-2.5">
                                    <span className="text-[10px] bg-slate-800/80 px-2 py-0.5 rounded text-slate-400">
                                      Asset: {stock.symbol}
                                    </span>
                                    <span className="text-[10px] bg-slate-800/80 px-2 py-0.5 rounded text-slate-400">
                                      Confidence: {signal.confidence}%
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-xs text-slate-400">
                                    No live AI assessment computed for {stock.symbol} yet. Click "Run AI Signal" to summon the server-side Gemini intelligence engine.
                                  </p>
                                  <button
                                    onClick={() => onAnalyze(stock.symbol)}
                                    disabled={isAnalyzing[stock.symbol]}
                                    className="mt-3 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-bold px-3 py-1.5 rounded-lg border border-indigo-500/25 transition inline-flex items-center gap-1.5"
                                  >
                                    {isAnalyzing[stock.symbol] ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Cpu className="w-3.5 h-3.5" />
                                    )}
                                    Compute Rating Now
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </section>
  );
}
