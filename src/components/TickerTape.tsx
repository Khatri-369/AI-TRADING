import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, RefreshCw } from 'lucide-react';
import { LivePrice, ThemeColors } from '../types/market';

interface TickerTapeProps {
  prices: LivePrice[];
  colors: ThemeColors;
  onRefresh: () => void;
  isUpdating: boolean;
}

export default function TickerTape({ prices, colors, onRefresh, isUpdating }: TickerTapeProps) {
  // Duplicate list to achieve seamless infinite horizontal scrolling marquee
  const tickerItems = [...prices, ...prices, ...prices];

  return (
    <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950 border-y border-slate-800/50 py-4 relative overflow-hidden flex items-center group shadow-lg">
      {/* Fixed Left Label */}
      <div className="absolute left-0 top-0 bottom-0 px-5 bg-gradient-to-r from-slate-950 to-slate-950/95 z-20 flex items-center border-r border-slate-800/50 gap-2 shrink-0 select-none">
        <div className="p-1.5 bg-indigo-500/15 rounded-lg">
          <TrendingUp className={`w-4 h-4 ${colors.accent}`} />
        </div>
        <span className="text-xs font-bold tracking-wider uppercase text-slate-300">LIVE FEED</span>
        <button 
          onClick={onRefresh}
          disabled={isUpdating}
          className="p-1.5 hover:bg-slate-800/50 rounded-lg text-slate-500 hover:text-slate-200 transition-all duration-300"
          title="Manual Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Marquee Track */}
      <div className="flex gap-10 items-center pl-40 whitespace-nowrap animate-[marquee_50s_linear_infinite] hover:[animation-play-state:paused] cursor-pointer">
        {tickerItems.map((item, idx) => {
          const isUp = item.changePercent >= 0;
          return (
            <div
              key={`${item.symbol}-${idx}`}
              className="inline-flex items-center gap-3 border-r border-slate-800/50 pr-10 hover:bg-slate-800/30 px-3 py-1 rounded-lg transition-all duration-300"
            >
              <span className="text-xs font-bold uppercase text-slate-300">{item.name}</span>
              <span className="text-sm text-slate-200 font-mono font-semibold">
                {item.symbol === 'USD/INR' ? '₹' : '$'}
                {item.priceUSD ? item.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : item.priceINR.toLocaleString()}
              </span>
              <span
                className={`inline-flex items-center text-xs font-mono font-bold px-2 py-1 rounded-lg border ${
                  isUp 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}
              >
                {isUp ? (
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mr-1" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 shrink-0 mr-1" />
                )}
                {isUp ? '+' : ''}
                {item.changePercent.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Embedded CSS for marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
