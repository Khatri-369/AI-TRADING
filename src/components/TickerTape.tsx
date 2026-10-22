import { useState } from 'react';
import { TrendingUp, TrendingDown, X, Play, Pause } from 'lucide-react';
import type { Quote } from '../types/market';
import { formatPercent, formatPrice, formatTime } from '../utils/format';

import AssetIcon from './AssetIcon';

export default function TickerTape({
  quotes,
  loading,
  onSelect,
  onClose,
}: {
  quotes: Quote[];
  loading: boolean;
  paused?: boolean;
  secondsUntilRefresh?: number;
  onRefresh?: () => void;
  onSelect: (quote: Quote) => void;
  onClose?: () => void;
}) {
  const [isPaused, setIsPaused] = useState(false);

  if (quotes.length === 0 && !loading) {
    return null;
  }

  // Filter benchmarks and preserve a crisp, prominent ordering
  const prioritySymbols = ['NIFTY50', 'SENSEX', 'SPY', 'BTC', 'ETH', 'XAU', 'USD/INR', 'SOL', 'QQQ', 'XAG'];
  const orderedQuotes = [...quotes].sort((a, b) => {
    const idxA = prioritySymbols.indexOf(a.symbol);
    const idxB = prioritySymbols.indexOf(b.symbol);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  // Duplicate for smooth seamless continuous marquee animation
  const tickerItems = [...orderedQuotes, ...orderedQuotes];

  return (
    <aside
      aria-label="Market benchmark ticker"
      className="relative flex min-w-0 items-center overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] backdrop-blur-sm select-none"
    >
      {/* Sleek Minimal Status Tag on Desktop, subtle pulse on mobile (NO duplicate sync button) */}
      <div className="flex shrink-0 items-center gap-1.5 border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-2 z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase hidden sm:inline">
          Live Markets
        </span>
      </div>

      {/* Movable Continuous Marquee Track */}
      <div
        className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-none py-1.5"
        role="region"
        aria-label="Benchmark quotes stream"
      >
        <div
          className={`ticker-track flex items-center gap-2 px-2 ${isPaused ? '!animate-none' : ''}`}
          style={{ animationPlayState: isPaused ? 'paused' : undefined }}
        >
          {loading && quotes.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)] px-3">
              Syncing live benchmark stream…
            </span>
          ) : (
            tickerItems.map((quote, idx) => {
              const isGain = (quote.changePercent ?? 0) >= 0;
              const hasChange = quote.changePercent !== null;
              return (
                <button
                  key={`${quote.symbol}-${idx}`}
                  type="button"
                  onClick={() => onSelect(quote)}
                  className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                  title={`${quote.name} · ${quote.category.toUpperCase()} · As of ${formatTime(quote.asOf)}`}
                >
                  <AssetIcon symbol={quote.symbol} category={quote.category} size="xs" />
                  <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                    {quote.symbol}
                  </span>

                  <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)] ml-0.5">
                    {formatPrice(quote.price, quote.currency)}
                  </span>

                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                      !hasChange
                        ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        : isGain
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {hasChange && (
                      isGain ? (
                        <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5 shrink-0" />
                      )
                    )}
                    {formatPercent(quote.changePercent)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Control Actions: Pause/Play & Dismiss */}
      <div className="flex shrink-0 items-center gap-1 border-l border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-1.5 py-1 z-10">
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded transition"
          aria-label={isPaused ? 'Resume ticker movement' : 'Pause ticker movement'}
          title={isPaused ? 'Resume scrolling' : 'Pause scrolling'}
        >
          {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded transition"
            aria-label="Remove benchmark ticker bar"
            title="Hide ticker bar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
