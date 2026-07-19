import React, { useState } from 'react';
import { ShieldAlert, TrendingUp, ChevronDown, ChevronUp, Activity, Code, Cpu, RefreshCw } from 'lucide-react';
import { ThemeColors } from '../types/market';

interface IndianEquityPanelProps {
  colors: ThemeColors;
}

interface NiftyStock {
  symbol: string;
  name: string;
  ltp: number;
  changePercent: number;
  volume: string;
  signal: 'Buy' | 'Sell' | 'Hold';
  confidence: number;
  sector: 'IT' | 'Auto' | 'Pharma' | 'FMCG' | 'Banking' | 'Heavy Industries';
  isBankNifty: boolean;
  rationale: string;
}

const INITIAL_NIFTY_STOCKS: NiftyStock[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', ltp: 2420.50, changePercent: 1.25, volume: '4.2M', signal: 'Buy', confidence: 82, sector: 'Heavy Industries', isBankNifty: false, rationale: 'Energy margins showing recovery + expansion in retail and telecom metrics.' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', ltp: 3210.15, changePercent: -0.85, volume: '1.8M', signal: 'Hold', confidence: 64, sector: 'IT', isBankNifty: false, rationale: 'Decline driven by cautious discretionary spending in European sectors.' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', ltp: 1545.00, changePercent: 0.45, volume: '8.5M', signal: 'Buy', confidence: 75, sector: 'Banking', isBankNifty: true, rationale: 'Post-merger synergy synergies starting to realize. Strong loan book growth.' },
  { symbol: 'INFY', name: 'Infosys Ltd.', ltp: 1422.30, changePercent: -1.15, volume: '2.5M', signal: 'Hold', confidence: 58, sector: 'IT', isBankNifty: false, rationale: 'Guidance downgrade impacts short term outlook; high relative valuations.' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', ltp: 925.40, changePercent: 1.85, volume: '5.2M', signal: 'Buy', confidence: 89, sector: 'Banking', isBankNifty: true, rationale: 'Industry leading NIM margins and robust reduction in gross NPA counts.' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', ltp: 890.10, changePercent: 2.10, volume: '3.1M', signal: 'Buy', confidence: 81, sector: 'Heavy Industries', isBankNifty: false, rationale: 'ARPU growth positive on tariff hikes and strong premium subscriber migrations.' },
  { symbol: 'SBIN', name: 'State Bank of India', ltp: 580.45, changePercent: -0.35, volume: '9.2M', signal: 'Hold', confidence: 60, sector: 'Banking', isBankNifty: true, rationale: 'Slight treasury losses but credit quality remains highly insulated.' },
  { symbol: 'LICI', name: 'Life Insurance Corporation of India', ltp: 645.10, changePercent: 0.05, volume: '1.1M', signal: 'Hold', confidence: 50, sector: 'Heavy Industries', isBankNifty: false, rationale: 'Stable premiums but transition to higher-margin products remains slow.' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', ltp: 2485.00, changePercent: 0.65, volume: '1.2M', signal: 'Buy', confidence: 70, sector: 'FMCG', isBankNifty: false, rationale: 'Rural demand recovery and palm oil cooling provides margins support.' },
  { symbol: 'ITC', name: 'ITC Ltd.', ltp: 415.20, changePercent: 1.40, volume: '7.8M', signal: 'Buy', confidence: 78, sector: 'FMCG', isBankNifty: false, rationale: 'Strong cigarette volume growth and hotel demerger unlocking massive value.' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', ltp: 2650.00, changePercent: 2.50, volume: '2.1M', signal: 'Buy', confidence: 91, sector: 'Heavy Industries', isBankNifty: false, rationale: 'Order book touches lifetime highs on domestic infrastructure capex boom.' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', ltp: 7120.00, changePercent: -1.65, volume: '1.4M', signal: 'Sell', confidence: 73, sector: 'Banking', isBankNifty: false, rationale: 'Competitive pricing pressure in personal loans impacts growth outlook.' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', ltp: 1145.30, changePercent: 0.20, volume: '1.7M', signal: 'Hold', confidence: 55, sector: 'IT', isBankNifty: false, rationale: 'Engineering services growth mitigates standard software slowdown.' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', ltp: 1540.00, changePercent: 1.10, volume: '1.9M', signal: 'Buy', confidence: 79, sector: 'Auto', isBankNifty: false, rationale: 'Unfilled order backlogs for SUV lineups provide revenue visibility.' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd.', ltp: 1120.50, changePercent: 0.50, volume: '1.3M', signal: 'Hold', confidence: 67, sector: 'Pharma', isBankNifty: false, rationale: 'Specialty portfolio in US growing, but high compliance costs cap gains.' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', ltp: 620.40, changePercent: 3.15, volume: '8.1M', signal: 'Buy', confidence: 88, sector: 'Auto', isBankNifty: false, rationale: 'JLR margins at multi-year highs and dominant EV market share in India.' },
  { symbol: 'NTPC', name: 'NTPC Ltd.', ltp: 195.80, changePercent: 0.75, volume: '5.5M', signal: 'Buy', confidence: 74, sector: 'Heavy Industries', isBankNifty: false, rationale: 'Capacity expansions in green energy segment fuels long-term capex.' },
  { symbol: 'TITAN', name: 'Titan Company Ltd.', ltp: 2980.00, changePercent: -0.40, volume: '1.0M', signal: 'Hold', confidence: 61, sector: 'FMCG', isBankNifty: false, rationale: 'Gold price volatility impacts near term jewelry demand sentiments.' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', ltp: 8210.00, changePercent: 1.55, volume: '0.8M', signal: 'Buy', confidence: 76, sector: 'Heavy Industries', isBankNifty: false, rationale: 'Rebates and price hikes offset higher input fuel and freight metrics.' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd.', ltp: 242.15, changePercent: 0.10, volume: '3.6M', signal: 'Hold', confidence: 52, sector: 'Heavy Industries', isBankNifty: false, rationale: 'Cap on regulated returns means steady dividends but low growth delta.' }
];

export default function IndianEquityPanel({ colors }: IndianEquityPanelProps) {
  const [filterTab, setFilterTab] = useState<'nifty' | 'banknifty' | 'it' | 'auto' | 'pharma' | 'fmcg'>('nifty');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  // Filter stocks based on current tab selection
  const displayedStocks = INITIAL_NIFTY_STOCKS.filter((stock) => {
    if (filterTab === 'banknifty') return stock.isBankNifty;
    if (filterTab === 'it') return stock.sector === 'IT';
    if (filterTab === 'auto') return stock.sector === 'Auto';
    if (filterTab === 'pharma') return stock.sector === 'Pharma';
    if (filterTab === 'fmcg') return stock.sector === 'FMCG';
    return true; // nifty
  });

  const getSparklinePath = (changePercent: number) => {
    const points = 10;
    const height = 30;
    const width = 100;
    const step = width / (points - 1);
    const dataPoints: number[] = [];
    
    let currentVal = height / 2;
    for (let i = 0; i < points; i++) {
      const noise = (Math.random() - 0.5) * 8;
      const trend = (changePercent / 100) * (i / points) * 10;
      dataPoints.push(Math.min(Math.max(currentVal - noise - trend, 2), height - 2));
    }
    return dataPoints.map((val, idx) => `${idx * step},${val}`).join(' L ');
  };

  return (
    <section id="indian-equity" className="scroll-mt-28 mb-8">
      <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300`}>
        
        {/* Panel Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isWeekend ? 'bg-slate-500' : 'bg-red-500 animate-pulse'}`} />
              <h2 className="text-xl font-bold tracking-tight">NSE Indian Equities (Nifty 50)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Top capitalised equities listed on the National Stock Exchange (NSE) of India.
            </p>
          </div>

          {/* Tab Filter & Closed indicator */}
          <div className="flex flex-wrap items-center gap-3">
            {isWeekend && (
              <span className="text-xs px-2.5 py-1 font-semibold rounded-lg border border-slate-800 text-slate-400 bg-slate-900/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Markets Closed
              </span>
            )}

            <div className="flex flex-wrap bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 gap-0.5 max-w-full">
              {(['nifty', 'banknifty', 'it', 'auto', 'pharma', 'fmcg'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1.5 rounded transition ${
                    filterTab === tab
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'nifty' ? 'Nifty 50' : tab === 'banknifty' ? 'Bank Nifty' : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Top 20 Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-slate-500 text-xs font-bold uppercase tracking-wider pb-3">
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4">LTP</th>
                <th className="py-2.5 px-4">Change %</th>
                <th className="py-2.5 px-4 hidden sm:table-cell">Volume</th>
                <th className="py-2.5 px-4 text-center">AI Rating</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40 text-sm">
              {displayedStocks.map((stock) => {
                const isExpanded = expandedSymbol === stock.symbol;
                const isUp = stock.changePercent >= 0;

                return (
                  <React.Fragment key={stock.symbol}>
                    <tr
                      onClick={() => setExpandedSymbol(isExpanded ? null : stock.symbol)}
                      className="hover:bg-slate-900/30 cursor-pointer transition-all duration-100"
                    >
                      {/* Symbol */}
                      <td className="py-3 px-4 font-bold">
                        <div>
                          <span className="text-white font-semibold">{stock.symbol}</span>
                          <span className="text-[10px] text-slate-500 block font-normal">{stock.name}</span>
                        </div>
                      </td>

                      {/* LTP */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        ₹{stock.ltp.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Change % */}
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold ${
                            isWeekend
                              ? 'text-slate-400 bg-slate-900 border border-slate-800'
                              : isUp 
                              ? 'text-emerald-400 bg-emerald-500/10' 
                              : 'text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {isWeekend ? (
                            'CLOSED'
                          ) : (
                            <>
                              {isUp ? '+' : ''}
                              {stock.changePercent.toFixed(2)}%
                            </>
                          )}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 hidden sm:table-cell">
                        {stock.volume}
                      </td>

                      {/* AI Signal Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            stock.signal === 'Buy'
                              ? colors.positiveBg + ' ' + colors.positiveText
                              : stock.signal === 'Sell'
                              ? colors.negativeBg + ' ' + colors.negativeText
                              : colors.neutralBg + ' ' + colors.neutralText
                          }`}
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          {stock.signal} ({stock.confidence}%)
                        </span>
                      </td>

                      {/* Expand Button */}
                      <td className="py-3 px-4 text-right">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 inline-block" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 inline-block" />
                        )}
                      </td>
                    </tr>

                    {/* Row Expansion */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-950/40 p-4 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            
                            {/* Trend Sparkline */}
                            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-bold flex items-center gap-1">
                                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                30-Day Trend Sparkline
                              </div>
                              <div className="h-10 flex items-center justify-center">
                                <svg className="w-full h-full animate-[pulse_3s_infinite]" viewBox="0 0 100 30">
                                  <path
                                    d={`M 0,${getSparklinePath(stock.changePercent)}`}
                                    fill="none"
                                    stroke={isUp ? '#10b981' : '#f43f5e'}
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </div>
                            </div>

                            {/* Signal Details */}
                            <div className="md:col-span-2 p-3 bg-indigo-950/10 border border-indigo-500/10 rounded-xl">
                              <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1 mb-1">
                                <Cpu className="w-3.5 h-3.5" /> Nifty AI Rationale
                              </h4>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {stock.rationale}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                                  Sector: {stock.sector}
                                </span>
                                <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                                  Model Confidence: {stock.confidence}%
                                </span>
                              </div>
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
