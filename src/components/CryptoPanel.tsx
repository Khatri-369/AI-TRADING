import React from 'react';
import { Coins, ArrowUpRight, ArrowDownRight, Compass, Cpu, RefreshCw } from 'lucide-react';
import { LivePrice, ThemeColors } from '../types/market';

interface CryptoPanelProps {
  cryptoPrices: LivePrice[];
  colors: ThemeColors;
  onAnalyze: (symbol: string) => void;
  isAnalyzing: Record<string, boolean>;
  analysisData: Record<string, any>;
}

export default function CryptoPanel({
  cryptoPrices,
  colors,
  onAnalyze,
  isAnalyzing,
  analysisData
}: CryptoPanelProps) {
  
  // Calculate dynamic Fear & Greed Index from the average 24h change of these top 5 crypto coins
  // If average change is 0%, index is 50. Scale is 0 (extreme fear) to 100 (extreme greed).
  const calculateFearGreedIndex = () => {
    if (cryptoPrices.length === 0) return 50;
    
    const totalChange = cryptoPrices.reduce((acc, curr) => acc + curr.changePercent, 0);
    const avgChange = totalChange / cryptoPrices.length;
    
    // Each 1% change above 0 adds 5 points, each 1% below subtracting 5. Max 100, Min 0.
    let index = 50 + Math.round(avgChange * 5);
    return Math.min(Math.max(index, 5), 95);
  };

  const indexValue = calculateFearGreedIndex();

  const getFearGreedLabel = (val: number) => {
    if (val >= 75) return { text: 'Extreme Greed', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (val >= 55) return { text: 'Greed', color: 'text-green-400 bg-green-500/10 border-green-500/20' };
    if (val >= 45) return { text: 'Neutral', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    if (val >= 25) return { text: 'Fear', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
    return { text: 'Extreme Fear', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const labelMeta = getFearGreedLabel(indexValue);

  return (
    <section id="crypto" className="scroll-mt-28 mb-8">
      <div className={`p-8 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300 shadow-xl ${colors.glow}`}>
        
        {/* Panel Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/30" />
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Coins className="w-6 h-6 text-indigo-400" />
                Crypto Assets Panel (No API Key Required)
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Top 5 sovereign digital assets. Synced directly from CoinGecko public nodes. Polled every 30s.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Top Coins Grid (Left 3 columns) */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {cryptoPrices.map((coin) => {
              const isUp = coin.changePercent >= 0;
              const signal = analysisData[coin.symbol] || null;

              return (
                <div
                  key={coin.symbol}
                  className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-500">{coin.name}</span>
                        <h3 className="text-lg font-bold text-white mt-1">{coin.symbol} / USD</h3>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
                          isUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        }`}
                      >
                        {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {isUp ? '+' : ''}
                        {coin.changePercent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="my-4">
                      <div className="text-2xl font-black font-mono text-slate-100">
                        ${coin.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm font-semibold font-mono text-indigo-400 mt-1">
                        ₹{coin.priceINR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-4 mt-2">
                    {signal ? (
                      <div className="text-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs uppercase font-bold text-indigo-300">AI Signal</span>
                          <span
                            className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border shadow-lg ${
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
                        <p className="text-xs text-slate-300 leading-snug line-clamp-2">{signal.rationale}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => onAnalyze(coin.symbol)}
                        disabled={isAnalyzing[coin.symbol]}
                        className="w-full text-xs bg-gradient-to-r from-indigo-500/15 to-purple-500/15 text-indigo-400 hover:from-indigo-500/25 hover:to-purple-500/25 py-2 rounded-lg font-bold border border-indigo-500/25 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                      >
                        {isAnalyzing[coin.symbol] ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Cpu className="w-4 h-4" />
                            Run AI Rating
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fear and Greed Index (Right 1 column) */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 flex flex-col items-center justify-between">
            <div className="w-full text-center">
              <div className="flex items-center gap-1.5 justify-center mb-1">
                <Compass className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-400">Momentum Index</h3>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                Crypto Market Fear & Greed metric calculated heuristically from top coins performance.
              </p>
            </div>

            {/* Custom SVG Speedometer */}
            <div className="relative w-40 h-24 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 100 60">
                
                {/* Colored segments */}
                {/* Red/Fear (10 to 42) */}
                <path
                  d="M 10 50 A 40 40 0 0 1 42 22"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="8"
                  opacity="0.8"
                />
                {/* Amber/Neutral (42 to 58) */}
                <path
                  d="M 42 22 A 40 40 0 0 1 58 22"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="8"
                  opacity="0.8"
                />
                {/* Green/Greed (58 to 90) */}
                <path
                  d="M 58 22 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  opacity="0.8"
                />

                {/* Animated Needle */}
                {/* Needle starts pointing left (-90 deg), rotates to point right (+90 deg) */}
                {/* Angle: -90 + (indexValue / 100) * 180 */}
                <g transform={`translate(50, 50) rotate(${-90 + (indexValue / 100) * 180})`}>
                  <path d="M -2 0 L 0 -38 L 2 0 Z" fill="#6366f1" />
                  <circle cx="0" cy="0" r="4" fill="#6366f1" />
                </g>
              </svg>

              <div className="absolute bottom-1 text-center">
                <div className="text-xl font-black font-mono text-white">{indexValue}</div>
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${labelMeta.color}`}>
                  {labelMeta.text}
                </span>
              </div>
            </div>

            <div className="w-full text-center text-[9px] text-slate-500 italic mt-3 border-t border-slate-900 pt-2 leading-relaxed">
              * Relies on standard 24h weighted asset momentum metrics. Updated in memory.
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
