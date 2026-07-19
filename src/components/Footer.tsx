import React from 'react';
import { ShieldAlert, Globe2 } from 'lucide-react';
import { ThemeColors } from '../types/market';

interface FooterProps {
  colors: ThemeColors;
}

export default function Footer({ colors }: FooterProps) {
  return (
    <footer className={`mt-16 border-t ${colors.border} bg-slate-950/60 py-8 text-center select-none`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4">
        
        <div className="flex items-center gap-2 text-slate-400">
          <Globe2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-widest">
            GLOBAL MARKETS COMMAND CENTER • TRADING TERMINAL
          </span>
        </div>

        {/* Extensive legal/demonstrative disclaimer footer */}
        <p className="max-w-4xl text-[10px] text-slate-500 leading-relaxed font-sans">
          <strong className="text-slate-400">LEGAL & FINANCIAL ADVISORY NOTICE:</strong> This application is a technology demonstration and research prototype. Real-time market metrics are supplied for educational exploration by public and commercial APIs (Finnhub, CoinGecko, and GoldAPI.io). AI-generated signals, sentiment scoring, and trade vectors are derived from synthetic analyses using LLM pattern-matching algorithms, and are NOT financial, investment, or legal trading recommendations. Indian equity data requires a private or licensed feed not included in this deployment. No trades are executed, and real financial assets are not at risk.
        </p>

        <div className="text-[10px] text-slate-600 mt-2">
          &copy; {new Date().getFullYear()} Global Markets Command Center. Powered by Gemini Flash 2.5 on Cloud Run. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
