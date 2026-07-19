import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Cpu, ArrowUpCircle, ArrowDownCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { ThemeColors } from '../types/market';

interface SignalSummaryDashboardProps {
  colors: ThemeColors;
  signals: Array<{
    symbol: string;
    asset: string;
    signal: 'Buy' | 'Sell' | 'Hold';
    confidence: number;
    rationale: string;
    type: 'Stock' | 'Crypto' | 'Commodity' | 'News';
  }>;
}

export default function SignalSummaryDashboard({ colors, signals }: SignalSummaryDashboardProps) {
  
  // Aggregate sentiment values for donut chart
  const sentimentDistribution = (() => {
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    signals.forEach((s) => {
      if (s.signal === 'Buy') buyCount++;
      else if (s.signal === 'Sell') sellCount++;
      else holdCount++;
    });

    const total = buyCount + sellCount + holdCount || 1;

    return [
      { name: 'Bullish (Buy)', value: Math.round((buyCount / total) * 100), color: '#10b981' },
      { name: 'Bearish (Sell)', value: Math.round((sellCount / total) * 100), color: '#f43f5e' },
      { name: 'Neutral (Hold)', value: Math.round((holdCount / total) * 100), color: '#eab308' }
    ];
  })();

  const buySignals = signals.filter(s => s.signal === 'Buy').slice(0, 3);
  const sellSignals = signals.filter(s => s.signal === 'Sell').slice(0, 3);

  return (
    <section id="summary-dashboard" className="scroll-mt-28 mb-8">
      <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300`}>
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-bold tracking-tight">Consolidated AI Signal Summary</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top Buys & Sells terminal (Left 2 columns) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Top Buys */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-900 pb-2 mb-3">
                <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                Active High-Confidence Buy Signals
              </h3>

              {buySignals.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-xs">
                  Analyzing financial headlines to establish premium buy recommendations...
                </div>
              ) : (
                <div className="space-y-3.5">
                  {buySignals.map((item, idx) => (
                    <div key={`${item.symbol}-${idx}`} className="p-3 bg-slate-900/40 rounded-lg border border-slate-800/60 hover:border-slate-800 transition">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-extrabold text-white font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-emerald-500/5 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/10">
                          {item.type} • Buy ({item.confidence}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-normal line-clamp-2">
                        {item.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Sells */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-900">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-900 pb-2 mb-3">
                <ArrowDownCircle className="w-5 h-5 text-rose-400" />
                Active High-Confidence Sell Signals
              </h3>

              {sellSignals.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-xs">
                  Analyzing news feeds to establish premium sell recommendations...
                </div>
              ) : (
                <div className="space-y-3.5">
                  {sellSignals.map((item, idx) => (
                    <div key={`${item.symbol}-${idx}`} className="p-3 bg-slate-900/40 rounded-lg border border-slate-800/60 hover:border-slate-800 transition">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-extrabold text-white font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-rose-500/5 text-rose-400 px-2 py-0.5 rounded border border-rose-500/10">
                          {item.type} • Sell ({item.confidence}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-normal line-clamp-2">
                        {item.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sentiment Distribution Pie Chart (Right 1 column) */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-900 flex flex-col items-center justify-between min-h-[300px]">
            <div className="w-full text-center">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-400 flex items-center justify-center gap-1.5 mb-1">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Aggregated Sentiment Share
              </h3>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Distribution of signals currently active in memory across all tracked assets.
              </p>
            </div>

            {/* Recharts Donut Pie Chart */}
            <div className="w-full h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sentimentDistribution.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#f1f5f9', fontSize: '11px', fontFamily: 'monospace' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={7}
                    formatter={(value) => <span className="text-[10px] text-slate-400 font-semibold uppercase">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Dynamic center label */}
              <div className="absolute top-[36%] text-center pointer-events-none">
                <div className="text-lg font-black text-white font-mono">
                  {signals.length}
                </div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                  Total
                </div>
              </div>
            </div>

            <div className="w-full border-t border-slate-900 pt-2 text-[9px] text-slate-500 italic text-center">
              * Relies on dynamically parsed backend models. Subject to market fluctuations.
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
