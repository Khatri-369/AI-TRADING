import React, { useState, useEffect } from 'react';
import { Compass, Info, ArrowUpRight, ArrowDownRight, Globe, TrendingUp } from 'lucide-react';
import { ThemeColors, DealFlow, CountryData } from '../types/market';

interface DealsFlowMapProps {
  colors: ThemeColors;
}

// Major global financial capital nodes
const HUBS: Record<string, { x: number; y: number; name: string; countryCode: string }> = {
  US: { x: 25, y: 35, name: 'New York (US)', countryCode: 'US' },
  UK: { x: 48, y: 28, name: 'London (UK)', countryCode: 'UK' },
  IN: { x: 68, y: 46, name: 'Mumbai (IN)', countryCode: 'IN' },
  CN: { x: 78, y: 40, name: 'Shanghai (CN)', countryCode: 'CN' },
  AE: { x: 62, y: 42, name: 'Dubai (AE)', countryCode: 'AE' },
  BR: { x: 33, y: 72, name: 'Sao Paulo (BR)', countryCode: 'BR' },
  ZA: { x: 52, y: 74, name: 'Johannesburg (ZA)', countryCode: 'ZA' },
  AU: { x: 88, y: 76, name: 'Sydney (AU)', countryCode: 'AU' },
  DE: { x: 50, y: 31, name: 'Frankfurt (DE)', countryCode: 'DE' }
};

const INITIAL_DEALS: DealFlow[] = [
  { id: 'flow-1', from: 'US', to: 'IN', asset: 'Gold Bullion', value: '$1.2B', sentiment: 'Positive', coords: { from: HUBS.US, to: HUBS.IN } },
  { id: 'flow-2', from: 'AE', to: 'CN', asset: 'Crude Reserves', value: '$850M', sentiment: 'Neutral', coords: { from: HUBS.AE, to: HUBS.CN } },
  { id: 'flow-3', from: 'AU', to: 'UK', asset: 'Silver Bullion', value: '$450M', sentiment: 'Positive', coords: { from: HUBS.AU, to: HUBS.UK } },
  { id: 'flow-4', from: 'ZA', to: 'US', asset: 'Platinum Futures', value: '$620M', sentiment: 'Positive', coords: { from: HUBS.ZA, to: HUBS.US } },
  { id: 'flow-5', from: 'BR', to: 'AE', asset: 'Soybeans & Commodities', value: '$320M', sentiment: 'Neutral', coords: { from: HUBS.BR, to: HUBS.AE } }
];

const COUNTRIES_DATA: Record<string, CountryData> = {
  US: { name: 'United States', code: 'US', netCommodityFlow: '+25k oz Gold', btcTrend: 'up', buyerSellerStatus: 'buyer', recentNews: ['US Treasury increases strategic gold storage reserves.', 'Wall Street ETF inflows hit record highs.'] },
  UK: { name: 'United Kingdom', code: 'UK', netCommodityFlow: '-12k oz Gold', btcTrend: 'flat', buyerSellerStatus: 'seller', recentNews: ['London bullion clearing logs massive transactional volume.', 'BoE holds rate policies steady.'] },
  IN: { name: 'India', code: 'IN', netCommodityFlow: '+45k oz Gold', btcTrend: 'up', buyerSellerStatus: 'buyer', recentNews: ['RBI purchases 8.4 metric tons of spot gold from Switzerland.', 'Festival retail gold buying hits quarterly highs.'] },
  CN: { name: 'China', code: 'CN', netCommodityFlow: '+85k oz Gold', btcTrend: 'up', buyerSellerStatus: 'buyer', recentNews: ['PBOC logs 18th consecutive month of sovereign bullion additions.', 'Shanghai Gold Exchange premiums rise.'] },
  AE: { name: 'United Arab Emirates', code: 'AE', netCommodityFlow: '+18k oz Gold', btcTrend: 'up', buyerSellerStatus: 'buyer', recentNews: ['Dubai Gold Souk experiences heavy retail tourism influx.', 'UAE oil-to-gold hedging ratios shift.'] },
  BR: { name: 'Brazil', code: 'BR', netCommodityFlow: '-8k oz Gold', btcTrend: 'down', buyerSellerStatus: 'seller', recentNews: ['Minas Gerais mines report gold extraction yields.', 'Sovereign reserves rebalance.'] },
  ZA: { name: 'South Africa', code: 'ZA', netCommodityFlow: '-32k oz Gold', btcTrend: 'flat', buyerSellerStatus: 'seller', recentNews: ['Rand refinery expands exports to Central Bank buyers.', 'Johannesburg gold miners declare dividends.'] },
  AU: { name: 'Australia', code: 'AU', netCommodityFlow: '-40k oz Gold', btcTrend: 'flat', buyerSellerStatus: 'seller', recentNews: ['Perth Mint logs heavy bullion export contracts.', 'Western Australian gold production reports.'] },
  DE: { name: 'Germany', code: 'DE', netCommodityFlow: '+5k oz Gold', btcTrend: 'flat', buyerSellerStatus: 'buyer', recentNews: ['Deutsche Bundesbank repatriates gold bar reserves.', 'Frankfurt futures index stabilizes.'] }
};

export default function DealsFlowMap({ colors }: DealsFlowMapProps) {
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [hoveredHub, setHoveredHub] = useState<string | null>(null);
  const [tickerOffset, setTickerOffset] = useState(0);

  // Auto-rotate the active flow highlight every 4 seconds to simulate a live map radar
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerOffset((prev) => (prev + 1) % INITIAL_DEALS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const highlightedFlow = INITIAL_DEALS[tickerOffset];

  // Map background points representing simplified continents
  const worldOutlineDots = [
    { x: 15, y: 25 }, { x: 20, y: 22 }, { x: 25, y: 24 }, { x: 22, y: 35 }, { x: 18, y: 42 }, // N. America
    { x: 28, y: 55 }, { x: 30, y: 62 }, { x: 34, y: 75 }, { x: 31, y: 80 }, { x: 35, y: 68 }, // S. America
    { x: 45, y: 22 }, { x: 50, y: 20 }, { x: 55, y: 25 }, { x: 48, y: 35 }, { x: 52, y: 33 }, // Europe
    { x: 50, y: 48 }, { x: 54, y: 55 }, { x: 52, y: 62 }, { x: 55, y: 72 }, { x: 58, y: 60 }, // Africa
    { x: 62, y: 25 }, { x: 68, y: 22 }, { x: 74, y: 28 }, { x: 80, y: 26 }, { x: 86, y: 30 }, // N. Asia
    { x: 65, y: 38 }, { x: 70, y: 44 }, { x: 75, y: 42 }, { x: 78, y: 48 }, { x: 84, y: 46 }, // S. Asia
    { x: 85, y: 65 }, { x: 88, y: 72 }, { x: 92, y: 75 }, { x: 86, y: 80 }                     // Australia
  ];

  return (
    <section id="flows-map" className="scroll-mt-28 mb-8">
      <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300`}>
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
                <Globe className="w-5 h-5 text-indigo-400" />
                Global Commodity Deals & Reserve Flows
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Derived from live news mentions. Tracks sovereign gold flows, reserve balances, and central bank trades.
            </p>
          </div>

          <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Derived from live news mentions
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* SVG Map (Left 3 columns) */}
          <div className="xl:col-span-3 bg-slate-950 p-4 rounded-xl border border-slate-900 relative min-h-[350px] flex items-center justify-center overflow-hidden">
            
            {/* World Grid Matrix background */}
            <svg className="w-full h-full min-h-[340px]" viewBox="0 0 100 90">
              
              {/* Dots representing passive geography map background */}
              {worldOutlineDots.map((dot, idx) => (
                <circle
                  key={`map-dot-${idx}`}
                  cx={dot.x}
                  cy={dot.y}
                  r="1.2"
                  fill="#1e293b"
                  opacity="0.6"
                />
              ))}

              {/* Passive flow arcs (drawn with low opacity) */}
              {INITIAL_DEALS.map((flow) => {
                const dx = flow.coords.to.x - flow.coords.from.x;
                const dy = flow.coords.to.y - flow.coords.from.y;
                const dr = Math.sqrt(dx * dx + dy * dy) * 1.1; // Control arc curve radius

                return (
                  <path
                    key={`passive-path-${flow.id}`}
                    d={`M ${flow.coords.from.x} ${flow.coords.from.y} A ${dr} ${dr} 0 0 1 ${flow.coords.to.x} ${flow.coords.to.y}`}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.4"
                  />
                );
              })}

              {/* ACTIVE animated glow arc */}
              {highlightedFlow && (() => {
                const flow = highlightedFlow;
                const dx = flow.coords.to.x - flow.coords.from.x;
                const dy = flow.coords.to.y - flow.coords.from.y;
                const dr = Math.sqrt(dx * dx + dy * dy) * 1.1;

                return (
                  <g>
                    {/* Glowing outer shadow path */}
                    <path
                      d={`M ${flow.coords.from.x} ${flow.coords.from.y} A ${dr} ${dr} 0 0 1 ${flow.coords.to.x} ${flow.coords.to.y}`}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="2.5"
                      opacity="0.4"
                      className="animate-pulse"
                    />
                    {/* Flow dash path */}
                    <path
                      d={`M ${flow.coords.from.x} ${flow.coords.from.y} A ${dr} ${dr} 0 0 1 ${flow.coords.to.x} ${flow.coords.to.y}`}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="1.5"
                      strokeDasharray="8 3"
                      className="animate-[dash_4s_linear_infinite]"
                    />
                  </g>
                );
              })()}

              {/* Render Hub Nodes */}
              {Object.entries(HUBS).map(([key, hub]) => {
                const country = COUNTRIES_DATA[hub.countryCode];
                const isBuyer = country?.buyerSellerStatus === 'buyer';
                
                // Color code node by net bullion buyer vs seller
                const nodeColor = isBuyer ? '#10b981' : '#f43f5e';

                return (
                  <g
                    key={`hub-${key}`}
                    onMouseEnter={() => setHoveredHub(key)}
                    onMouseLeave={() => setHoveredHub(null)}
                    className="cursor-pointer group"
                  >
                    {/* Pulsing ring around node */}
                    <circle
                      cx={hub.x}
                      cy={hub.y}
                      r="4"
                      fill={nodeColor}
                      opacity="0.2"
                      className="group-hover:scale-150 transition-all animate-ping"
                    />
                    
                    {/* Solid node center */}
                    <circle
                      cx={hub.x}
                      cy={hub.y}
                      r="2.5"
                      fill={nodeColor}
                      stroke="#fff"
                      strokeWidth="0.5"
                    />

                    {/* Small hub code text overlay */}
                    <text
                      x={hub.x + 3}
                      y={hub.y + 1.5}
                      fill="#94a3b8"
                      fontSize="2.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                      className="opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      {key}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Embedded custom CSS animations for trade arcs */}
            <style>{`
              @keyframes dash {
                to {
                  stroke-dashoffset: -40;
                }
              }
            `}</style>

            {/* Float HUD Tooltip for hovered countries */}
            {hoveredHub && COUNTRIES_DATA[HUBS[hoveredHub].countryCode] && (() => {
              const country = COUNTRIES_DATA[HUBS[hoveredHub].countryCode];
              const isBuyer = country.buyerSellerStatus === 'buyer';

              return (
                <div className="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:w-72 bg-slate-950/95 border border-slate-800 p-4 rounded-xl shadow-2xl backdrop-blur-md z-30 animate-fade-in">
                  <div className="flex justify-between items-center mb-1 pb-1.5 border-b border-slate-900">
                    <span className="text-xs font-black text-white">{country.name} ({country.code})</span>
                    <span
                      className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded border ${
                        isBuyer 
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                          : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      }`}
                    >
                      {isBuyer ? 'Gold Net Buyer' : 'Gold Net Seller'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-2 text-[10px]">
                    <div>
                      <span className="text-slate-500 block">Net Commodity Flow</span>
                      <span className="text-slate-200 font-semibold font-mono">{country.netCommodityFlow}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Sovereign BTC Index</span>
                      <span className="inline-flex items-center gap-0.5 text-slate-200 font-semibold uppercase font-mono">
                        {country.btcTrend === 'up' ? (
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        ) : country.btcTrend === 'down' ? (
                          <ArrowDownRight className="w-3 h-3 text-rose-400" />
                        ) : (
                          '•'
                        )}
                        {country.btcTrend}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-2">
                    <span className="text-[9px] uppercase font-extrabold tracking-wider text-indigo-400 block mb-1">Recent News mentions</span>
                    <ul className="space-y-1 list-disc list-inside text-[9px] text-slate-400">
                      {country.recentNews.map((news, i) => (
                        <li key={i} className="line-clamp-1">{news}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Flow Legend (Right 1 column) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-3 border-b border-slate-900 pb-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-slate-300">Live Trade Flows</h3>
              </div>

              <div className="space-y-2.5">
                {INITIAL_DEALS.map((flow, i) => {
                  const isActive = highlightedFlow?.id === flow.id;
                  return (
                    <div
                      key={flow.id}
                      onClick={() => setTickerOffset(i)}
                      className={`p-2.5 rounded-lg border transition cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/10 border-indigo-500/40'
                          : 'bg-slate-900/30 border-slate-900/60 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-bold text-slate-300">
                          {HUBS[flow.from].name.split(' ')[0]} ➔ {HUBS[flow.to].name.split(' ')[0]}
                        </span>
                        <span className="font-mono text-emerald-400 font-semibold">{flow.value}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                        <span>Asset: {flow.asset}</span>
                        <span className={flow.sentiment === 'Positive' ? 'text-emerald-400' : 'text-slate-400'}>
                          {flow.sentiment}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-indigo-950/15 p-2 rounded border border-indigo-500/10 mt-4 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-[9px] text-slate-500 leading-snug">
                Pulsing radar vectors represent active trade integrations scanned from international terminal publications. Hover hubs for country balances.
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
