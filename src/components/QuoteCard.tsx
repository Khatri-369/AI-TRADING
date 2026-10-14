import { ArrowUpRight } from 'lucide-react';
import type { Quote } from '../types/market';
import { changeClass, formatPercent, formatPrice, formatTime } from '../utils/format';
import StatusBadge from './StatusBadge';

export default function QuoteCard({
  quote,
  onSelect,
}: {
  quote: Quote;
  onSelect: (quote: Quote) => void;
}) {
  const isOpen = quote.session.state === 'OPEN';

  return (
    <article
      className="relative flex min-w-0 flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] p-4 transition-colors duration-150"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(quote)}
            className="text-left font-bold tracking-tight text-[var(--text-primary)] hover:text-[var(--accent-text)] transition"
          >
            {quote.symbol}
          </button>
          {quote.sector && (
            <span className="hidden rounded bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] sm:inline">
              {quote.sector}
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isOpen
              ? 'border border-[var(--gain-border)] bg-[var(--gain-bg)] text-[var(--gain-text)]'
              : 'border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)]'
          }`}
        >
          {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-[var(--gain-text)]" />}
          {quote.session.state}
        </span>
      </div>

      <h3 className="mt-1 truncate text-xs text-[var(--text-secondary)]" title={quote.name}>
        {quote.name}
      </h3>

      <div className="my-3.5">
        <p
          className={`font-mono text-2xl font-bold tabular-nums transition-colors duration-200 ${
            quote.price === null ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {formatPrice(quote.price, quote.currency)}
        </p>
        <p className={`mt-0.5 font-mono text-xs tabular-nums ${changeClass(quote.changePercent)}`}>
          {formatPercent(quote.changePercent)}
        </p>
      </div>

      <div className="mt-auto border-t border-[var(--border-subtle)] pt-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={quote.status} cached={quote.cached} />
          {quote.volume !== null ? (
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Vol: {Number(quote.volume).toLocaleString(undefined, { notation: 'compact' })}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]">{quote.provider}</span>
          )}
        </div>

        {quote.error && (
          <p className="mt-2 text-xs text-[var(--delayed-text)]">{quote.error}</p>
        )}

        <button
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition"
          onClick={() => onSelect(quote)}
          aria-label={`View ${quote.symbol} chart and research`}
        >
          <span>Interactive Chart</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
        </button>
      </div>
    </article>
  );
}
