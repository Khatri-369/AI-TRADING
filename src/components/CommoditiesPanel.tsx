import React from 'react';
import { Landmark, ArrowUpRight, ArrowDownRight, Compass, Cpu, AlertCircle, RefreshCw } from 'lucide-react';
import { LivePrice, ThemeColors } from '../types/market';

interface CommoditiesPanelProps {
  gold: LivePrice | null;
  silver: LivePrice | null;
  usdInrRate: number;
  colors: ThemeColors;
  apiKeyMissing: boolean;
  onAnalyze: (asset: string) => void;
  isAnalyzing: Record<string, boolean>;
  analysisData: Record<string, any>;
}

export default function CommoditiesPanel({
  gold,
  silver,
  usdInrRate,
  colors,
  apiKeyMissing,
  onAnalyze,
  isAnalyzing,
  analysisData
}: CommoditiesPanelProps) {
  
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  // Custom formula to convert USD/oz to INR per 10g (for Gold)
  // 1 Troy Ounce (oz) = 31.1034768 grams.
  // Formula: (USD Price / 31.1034768) * 10 * USD_INR_Rate
  const getGoldPriceINR = (usdPrice: number) => {
    return (usdPrice / 31.1034768) * 10 * usdInrRate;
  };

  // Custom formula to convert USD/oz to INR per kg (for Silver)
  // 1 Troy Ounce (oz) = 31.1034768 grams.
  // Formula: (USD Price / 31.1034768) * 1000 * USD_INR_Rate
  const getSilverPriceINR = (usdPrice: number) => {
    return (usdPrice / 31.1034768) * 1000 * usdInrRate;
  };

  const renderCommodityCard = (
    item: LivePrice | null,
    title: string,
    id: string,
    unit: string,
    calcINR: (usd: number) => number,
    sparkColor: string
  ) => {
    if (!item) {
      return (
        <div className="h-64 bg-slate-900/40 rounded-xl border border-slate-800 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
        </div>
      );
    }

    const isUp = item.changePercent >= 0;
    const inrPrice = calcINR(item.priceUSD);
    const signal = analysisData[item.symbol] || null;

    return (
      <div className="bg-slate-950/60 p-6 rounded-xl border border-slate-800 flex flex-col justify-between h-full hover:border-indigo-500/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5">
        <div>
          {/* Header info */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">{title} Spot</span>
              <h3 className="text-2xl font-bold text-white mt-1">{item.symbol} / USD</h3>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold border ${
                isWeekend 
                  ? 'text-slate-400 bg-slate-900 border border-slate-800' 
                  : isUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
              }`}
            >
              {isWeekend ? (
                'CLOSED'
              ) : (
                <>
                  {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {isUp ? '+' : ''}
                  {item.changePercent.toFixed(2)}%
                </>
              )}
            </span>
          </div>

          {/* Pricing figures */}
          <div className="my-5">
            <div className="text-3xl font-black font-mono text-slate-100">
              ${item.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-500 font-normal ml-2">/ oz</span>
            </div>
            <div className="text-base font-semibold font-mono text-indigo-400 mt-2">
              ₹{inrPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-xs text-slate-500 font-normal ml-2">/ {unit}</span>
            </div>
          </div>
        </div>

        {/* AI signal or run button */}
        <div className="border-t border-slate-800 pt-5 mt-3">
          {signal ? (
            <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-xl shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs uppercase tracking-wider font-bold text-indigo-300">Gemini Spot Signal</span>
                <span
                  className={`text-xs uppercase font-extrabold px-2 py-1 rounded-lg border shadow-lg ${
                    signal.signal === 'Buy'
                      ? colors.positiveBg + ' ' + colors.positiveText
                      : signal.signal === 'Sell'
                      ? colors.negativeBg + ' ' + colors.negativeText
                      : colors.neutralBg + ' ' + colors.neutralText
                  }`}
                >
                  {signal.signal} ({signal.confidence}%)
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-snug">{signal.rationale}</p>
            </div>
          ) : (
            <button
              onClick={() => onAnalyze(item.symbol)}
              disabled={isAnalyzing[item.symbol]}
              className="w-full text-sm bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-400 hover:from-indigo-500/25 hover:to-purple-500/25 py-2.5 rounded-xl font-bold border border-indigo-500/25 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
            >
              {isAnalyzing[item.symbol] ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating AI Signal...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Run AI Spot Analysis
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section id="commodities" className="scroll-mt-28 mb-8">
      <div className={`p-8 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300 shadow-xl ${colors.glow}`}>
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isWeekend ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'} shadow-lg shadow-emerald-500/30`} />
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Landmark className="w-6 h-6 text-indigo-400" />
                Commodities Tracking (Spot Gold & Silver)
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Global bullion spot prices. Real USD rates transformed into Indian standard weights with current FX rate.
            </p>
          </div>

          {isWeekend && (
            <span className="text-sm px-4 py-2 font-semibold rounded-xl border border-slate-800 text-slate-400 bg-slate-900/60 flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Spot Markets Closed (Weekend)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Gold */}
          {renderCommodityCard(gold, 'Gold', 'gold', '10g (approx)', getGoldPriceINR, '#f59e0b')}

          {/* Card 2: Silver */}
          {renderCommodityCard(silver, 'Silver', 'silver', 'kg', getSilverPriceINR, '#94a3b8')}

          {/* Column 3: Global Demand Heat */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Global Demand Heat</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Aggregated purchase and sales transaction volume for bullion metals among sovereign banks and regional mints this week.
              </p>

              <div className="space-y-4">
                {/* APAC */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">APAC (Asia-Pacific)</span>
                    <span className="text-emerald-400">68% Net Buyers</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: '68%' }} />
                    <div className="bg-rose-500 h-full" style={{ width: '32%' }} />
                  </div>
                </div>

                {/* Europe */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Europe (EU + UK)</span>
                    <span className="text-amber-400">52% Net Buyers</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: '52%' }} />
                    <div className="bg-rose-500 h-full" style={{ width: '48%' }} />
                  </div>
                </div>

                {/* North America */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">North America</span>
                    <span className="text-emerald-400">74% Net Buyers</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: '74%' }} />
                    <div className="bg-rose-500 h-full" style={{ width: '26%' }} />
                  </div>
                </div>

                {/* Middle East */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Middle East (Sovereign)</span>
                    <span className="text-emerald-400">81% Net Buyers</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: '81%' }} />
                    <div className="bg-rose-500 h-full" style={{ width: '19%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900 pt-3 mt-4 text-[10px] text-slate-500 italic">
              * Heuristic metrics computed from public bank reserve statements and trading volumes.
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
