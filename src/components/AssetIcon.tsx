import React from 'react';

interface AssetIconProps {
  symbol: string;
  category?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5 text-[10px]',
  sm: 'w-4 h-4 text-xs',
  md: 'w-5 h-5 text-sm',
  lg: 'w-6 h-6 text-base',
};

const PIXEL_MAP = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
};

/**
 * Returns a high-definition, theme-consistent SVG or badge for financial assets.
 * Replaces generic trophy icons with real gold bullion/bars and provides
 * dedicated, authentic icons for Indian, US, BTC, and USD/INR pairs.
 */
export default function AssetIcon({
  symbol,
  category,
  size = 'sm',
  className = '',
}: AssetIconProps) {
  const px = PIXEL_MAP[size];
  const sizeCls = SIZE_MAP[size];
  const sym = symbol.toUpperCase().replace(/\.BSE$/, '');

  // 1. Gold Commodity (XAU) - Sleek Gold Bullion Ingot (AU 999.9)
  if (sym === 'XAU' || sym === 'GOLD') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${sizeCls} ${className}`}
        aria-label="Gold (XAU)"
      >
        <title>Gold (XAU) Bullion</title>
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="35%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="goldSheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {/* Trapezoid gold bar */}
        <path
          d="M4.5 17.5L2 19.5H22L19.5 17.5H4.5Z"
          fill="#92400E"
        />
        <path
          d="M5 7L2 19.5H22L19 7H5Z"
          fill="url(#goldGradient)"
          stroke="#78350F"
          strokeWidth="0.75"
        />
        <polygon
          points="5.5,8 18.5,8 17.2,12 6.8,12"
          fill="url(#goldSheen)"
        />
        {/* Stamp "AU" */}
        <text
          x="12"
          y="15.5"
          fill="#78350F"
          fontSize="4.8"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          AU
        </text>
      </svg>
    );
  }

  // 2. Silver Commodity (XAG) - Sleek Silver Bullion Ingot (AG 999)
  if (sym === 'XAG' || sym === 'SILVER') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${sizeCls} ${className}`}
        aria-label="Silver (XAG)"
      >
        <title>Silver (XAG) Bullion</title>
        <defs>
          <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="40%" stopColor="#CBD5E1" />
            <stop offset="70%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
        </defs>
        <path d="M4.5 17.5L2 19.5H22L19.5 17.5H4.5Z" fill="#475569" />
        <path
          d="M5 7L2 19.5H22L19 7H5Z"
          fill="url(#silverGradient)"
          stroke="#334155"
          strokeWidth="0.75"
        />
        <text
          x="12"
          y="15.5"
          fill="#334155"
          fontSize="4.8"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          AG
        </text>
      </svg>
    );
  }

  // 3. Bitcoin (BTC) - Signature Orange Circular ₿ Badge
  if (sym === 'BTC' || sym === 'BITCOIN') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${sizeCls} ${className}`}
        aria-label="Bitcoin (BTC)"
      >
        <title>Bitcoin (BTC)</title>
        <circle cx="12" cy="12" r="11" fill="#F7931A" stroke="#E27D07" strokeWidth="0.75" />
        <path
          d="M14.6 11.2C15.2 10.8 15.6 10.1 15.4 9.2C15.1 7.8 13.7 7.5 12.1 7.5V5.5H10.8V7.5H9.8V5.5H8.5V7.5H6.5V9H8V15H6.5V16.5H8.5V18.5H9.8V16.5H10.8V18.5H12.1V16.5C14.3 16.5 15.9 15.7 16.2 13.9C16.4 12.5 15.8 11.7 14.6 11.2ZM10.2 9.2H12C12.8 9.2 13.6 9.5 13.6 10.4C13.6 11.3 12.8 11.6 12 11.6H10.2V9.2ZM12.3 14.8H10.2V12.4H12.3C13.2 12.4 14.1 12.8 14.1 13.6C14.1 14.4 13.2 14.8 12.3 14.8Z"
          fill="white"
        />
      </svg>
    );
  }

  // 4. Ethereum (ETH) - Crisp Diamond Prism
  if (sym === 'ETH' || sym === 'ETHEREUM') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${sizeCls} ${className}`}
        aria-label="Ethereum (ETH)"
      >
        <title>Ethereum (ETH)</title>
        <circle cx="12" cy="12" r="11" fill="#627EEA" stroke="#4C66D6" strokeWidth="0.75" />
        <path d="M12 3.5L6.5 12.5L12 15.8L17.5 12.5L12 3.5Z" fill="#C0CBF8" />
        <path d="M12 3.5L12 15.8L17.5 12.5L12 3.5Z" fill="white" />
        <path d="M12 16.7L6.5 13.6L12 20.5L17.5 13.6L12 16.7Z" fill="#C0CBF8" />
        <path d="M12 16.7L12 20.5L17.5 13.6L12 16.7Z" fill="white" />
      </svg>
    );
  }

  // 5. USD / INR Currency Pair - Dual Flag & Exchange Arrows ($ ⇄ ₹)
  if (sym === 'USD/INR' || sym === 'USDINR' || sym === 'USD_INR') {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold tracking-tight rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1 py-0.5 font-mono select-none ${className}`}
        style={{ fontSize: Math.max(9, px * 0.55), lineHeight: 1 }}
        title="USD / INR Forex Reference Rate"
      >
        <span className="text-emerald-300">$</span>
        <span className="text-[var(--text-muted)] mx-0.5 text-[8px]">⇄</span>
        <span className="text-amber-400">₹</span>
      </span>
    );
  }

  // 6. Indian Equities & Indices (NIFTY50, SENSEX, BANKNIFTY, RELIANCE, TCS, etc.)
  if (
    category === 'india' ||
    ['NIFTY50', 'SENSEX', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'LICI', 'HINDUNILVR', 'ITC', 'LT', 'BAJFINANCE', 'HCLTECH', 'M&M', 'SUNPHARMA', 'TATAMOTORS', 'NTPC', 'TITAN', 'ULTRACEMCO', 'POWERGRID'].includes(sym)
  ) {
    return (
      <svg
        viewBox="0 0 24 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 rounded-xs overflow-hidden border border-[var(--border-subtle)] ${sizeCls} ${className}`}
        aria-label="Indian Market Instrument"
      >
        <title>India · NSE / BSE</title>
        {/* Tricolor */}
        <rect width="24" height="5.33" fill="#FF9933" />
        <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
        <rect y="10.67" width="24" height="5.33" fill="#138808" />
        {/* Ashoka Chakra Center */}
        <circle cx="12" cy="8" r="2" stroke="#000088" strokeWidth="0.6" fill="none" />
        <circle cx="12" cy="8" r="0.5" fill="#000088" />
      </svg>
    );
  }

  // 7. US Equities & Indices (SPY, QQQ, AAPL, MSFT, NVDA, TSLA, AMZN, GOOGL, META)
  if (
    category === 'us' ||
    ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'].includes(sym)
  ) {
    return (
      <svg
        viewBox="0 0 24 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 rounded-xs overflow-hidden border border-[var(--border-subtle)] ${sizeCls} ${className}`}
        aria-label="US Market Instrument"
      >
        <title>United States · NYSE / NASDAQ</title>
        {/* Stripes */}
        <rect width="24" height="16" fill="#B22234" />
        <rect y="2.46" width="24" height="2.46" fill="#FFFFFF" />
        <rect y="7.38" width="24" height="2.46" fill="#FFFFFF" />
        <rect y="12.30" width="24" height="2.46" fill="#FFFFFF" />
        {/* Blue Canton */}
        <rect width="10" height="9.8" fill="#3C3B6E" />
        {/* Star dots */}
        <circle cx="2.5" cy="2.5" r="0.65" fill="#FFFFFF" />
        <circle cx="5.0" cy="2.5" r="0.65" fill="#FFFFFF" />
        <circle cx="7.5" cy="2.5" r="0.65" fill="#FFFFFF" />
        <circle cx="3.75" cy="5.0" r="0.65" fill="#FFFFFF" />
        <circle cx="6.25" cy="5.0" r="0.65" fill="#FFFFFF" />
        <circle cx="2.5" cy="7.5" r="0.65" fill="#FFFFFF" />
        <circle cx="5.0" cy="7.5" r="0.65" fill="#FFFFFF" />
        <circle cx="7.5" cy="7.5" r="0.65" fill="#FFFFFF" />
      </svg>
    );
  }

  // 8. Other Cryptocurrencies (SOL, BNB, XRP)
  if (sym === 'SOL') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-purple-500/20 text-purple-400 font-bold ${sizeCls} ${className}`}
        title="Solana (SOL)"
      >
        ◎
      </span>
    );
  }

  if (sym === 'BNB') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold ${sizeCls} ${className}`}
        title="BNB"
      >
        🟡
      </span>
    );
  }

  if (sym === 'XRP') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-slate-500/20 text-slate-300 font-bold ${sizeCls} ${className}`}
        title="XRP"
      >
        ✕
      </span>
    );
  }

  // 9. Generic Category Fallbacks
  if (category === 'commodities') {
    return <span className={sizeCls}>🪙</span>;
  }
  if (category === 'crypto') {
    return <span className={sizeCls}>🪙</span>;
  }
  if (category === 'forex') {
    return <span className={sizeCls}>💱</span>;
  }

  return <span className={sizeCls}>📈</span>;
}

/**
 * Clean text emoji helper for locations where only a string/emoji is supported.
 * Crucially replaces '🏆' with gold/coin and provides crisp symbols.
 */
export function getAssetEmoji(symbol: string, category?: string): string {
  const sym = symbol.toUpperCase().replace(/\.BSE$/, '');
  if (sym === 'XAU' || sym === 'GOLD') return '🪙'; // Gold coin / bullion, never trophy
  if (sym === 'XAG' || sym === 'SILVER') return '🥈';
  if (sym === 'BTC') return '₿';
  if (sym === 'ETH') return '⟠';
  if (sym === 'USD/INR' || sym === 'USDINR') return '₹';
  if (category === 'india') return '🇮🇳';
  if (category === 'us') return '🇺🇸';
  if (category === 'commodities') return '🪙';
  if (category === 'forex') return '💱';
  if (category === 'crypto') return '🪙';
  return '📈';
}
