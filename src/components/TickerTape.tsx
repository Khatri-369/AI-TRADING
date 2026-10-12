import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import type { Quote } from '../types/market';
import { changeClass, formatPercent, formatPrice, formatTime } from '../utils/format';
import StatusBadge from './StatusBadge';

export default function TickerTape({
  quotes,
  loading,
  paused,
  secondsUntilRefresh,
  onRefresh,
  onSelect,
}: {
  quotes: Quote[];
  loading: boolean;
  paused: boolean;
  secondsUntilRefresh?: number;
  onRefresh: () => void;
  onSelect: (quote: Quote) => void;
}) {
  return (
    <aside
      aria-label="Market benchmark ticker"
      className="flex min-w-0 items-center border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
    >
      <div className="flex shrink-0 items-center gap-2 border-r border-[var(--border-subtle)] px-3.5 py-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[var(--text-muted)]">
          <span
            className={`h-2 w-2 rounded-full ${
              paused
                ? 'bg-[var(--delayed-text)]'
                : loading
                ? 'bg-[var(--accent-primary)] animate-ping'
                : 'bg-[var(--gain-text)]'
            }`}
          />
          {paused
            ? 'PAUSED'
            : loading
            ? 'SYNCING…'
            : typeof secondsUntilRefresh === 'number'
            ? `SYNC ${secondsUntilRefresh}s`
            : 'BENCHMARKS'}
        </span>
        <button
          className="icon-button h-6 w-6 p-1"
          aria-label="Refresh market benchmarks"
          title="Refresh market benchmarks"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto px-4 py-1.5 text-xs"
        role="region"
        aria-label="Benchmark quotes stream"
      >
        {quotes.length === 0 ? (
          <span className="text-xs text-[var(--text-muted)]">
            {loading ? 'Loading market quotes…' : 'No quotes to display'}
          </span>
        ) : (
          quotes.slice(0, 16).map((quote) => {
            const isPositive = (quote.changePercent ?? 0) >= 0;
            return (
              <button
                key={quote.symbol}
                onClick={() => onSelect(quote)}
                className="group flex shrink-0 items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-[var(--bg-surface-hover)]"
                title={`${quote.name} · ${quote.provider} · Quote: ${formatTime(quote.asOf)}`}
              >
                <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)]">
                  {quote.symbol}
                </span>
                <StatusBadge status={quote.status} cached={quote.cached} />
                <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatPrice(quote.price, quote.currency)}
                </span>
                <span className={`flex items-center gap-0.5 font-mono tabular-nums text-[11px] ${changeClass(quote.changePercent)}`}>
                  {quote.changePercent !== null && (
                    isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                  {quote.changePercent === null ? '—' : formatPercent(quote.changePercent)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
