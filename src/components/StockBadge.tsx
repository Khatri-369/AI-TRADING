import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Quote } from '../types/market';
import { getStockBadgeData } from '../utils/stockDisplay';
import AssetIcon from './AssetIcon';

interface StockBadgeProps {
  symbol: string;
  quote?: Quote | null;
  onClick?: () => void;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StockBadge({
  symbol,
  quote,
  onClick,
  title,
  size = 'md',
  className = '',
}: StockBadgeProps) {
  const data = getStockBadgeData(symbol, quote);
  const isGain = data.isGain;
  const isLoss = data.hasChange && !isGain;
  const isFlat = data.hasChange && data.changePercentFormatted?.includes('0.00%');

  // Badge styling matching green/red trend
  const colorClasses = data.hasChange
    ? isGain
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
      : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
    : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)]';

  const defaultTitle = title || (onClick ? `Open ${data.name} (${data.symbol}) in Research Desk` : undefined);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={defaultTitle}
      className={`group inline-flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono transition text-left cursor-pointer min-h-[32px] ${colorClasses} ${className}`}
    >
      <AssetIcon symbol={data.symbol} size="xs" />

      {/* Stock Name and Symbol */}
      <span className="inline-flex items-baseline gap-1 text-[11px] leading-tight">
        <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] truncate max-w-[120px] sm:max-w-[160px]">
          {data.name}
        </span>
        <span className="font-bold text-[var(--text-secondary)] opacity-90 text-[10px]">
          ({data.symbol})
        </span>
      </span>

      {/* Latest Price */}
      {data.hasPrice && (
        <span className="font-bold text-[11px] px-1 py-0.5 rounded bg-black/15 text-[var(--text-primary)]">
          {data.priceFormatted}
        </span>
      )}

      {/* Green/Red Arrow & Percentage */}
      {data.hasChange ? (
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded ${
            isGain
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {isGain ? (
            <TrendingUp className="h-3 w-3 shrink-0 stroke-[2.5]" />
          ) : (
            <TrendingDown className="h-3 w-3 shrink-0 stroke-[2.5]" />
          )}
          <span>{data.changePercentFormatted}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
          <Minus className="h-2.5 w-2.5" />
          <span>Quote pending</span>
        </span>
      )}
    </button>
  );
}

