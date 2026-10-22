import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { TradexaSymbol } from './TradexaLogo';

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--stale-border)] bg-[var(--stale-bg)] p-4 text-sm text-[var(--stale-text)] shadow-xs animate-fade-in"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
      <span className="min-w-0 flex-1 break-words font-medium">{message}</span>
      {onRetry && (
        <button
          className="button-secondary text-xs px-3 py-1.5 min-h-[36px]"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Branded Tradexa Micro Loader
 */
export function TradexaLoader({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Outer ambient spin ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"
        style={{ width: size, height: size }}
      />
      <TradexaSymbol size={Math.round(size * 0.7)} framed={false} />
    </div>
  );
}

/**
 * Standard Status Loading Indicator
 */
export function Loading({
  label = 'Loading market data…',
  showTimer = false,
  sublabel,
}: {
  label?: string;
  showTimer?: boolean;
  sublabel?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!showTimer) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [showTimer]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-[var(--text-muted)] animate-fade-in"
    >
      <div className="flex items-center gap-3">
        <TradexaLoader size={30} />
        <span className="font-semibold text-xs sm:text-sm tracking-wide text-[var(--text-primary)]">
          {label}
        </span>
        {showTimer && (
          <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-cyan-400">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-[11px] text-[var(--text-secondary)] text-center max-w-md">
          {sublabel}
        </span>
      )}
    </div>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-12 text-center animate-fade-in">
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <TradexaSymbol size={160} framed={false} />
      </div>
      <p className="relative z-10 font-semibold text-sm text-[var(--text-primary)]">{title}</p>
      {detail && (
        <p className="relative z-10 mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[var(--text-secondary)]">
          {detail}
        </p>
      )}
    </div>
  );
}

/* =========================================================================
 * ADVANCED HIGH-FINANCE SKELETON LOADERS
 * ========================================================================= */

/**
 * Top Benchmark Card Skeleton (e.g. NIFTY, SENSEX, SPY horizontal badges)
 */
export function BenchmarkSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 space-y-2 skeleton-shimmer"
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-16 rounded bg-[var(--bg-muted)]" />
            <div className="h-4 w-4 rounded-full bg-[var(--bg-muted)]" />
          </div>
          <div className="h-3 w-20 rounded bg-[var(--bg-muted)]" />
          <div className="flex items-center justify-between pt-1">
            <div className="h-4 w-14 rounded bg-[var(--bg-muted)]" />
            <div className="h-3.5 w-10 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Quote Card Skeleton (Grid layout)
 */
export function QuoteCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2.5 skeleton-shimmer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-[var(--bg-muted)]" />
              <div className="space-y-1">
                <div className="h-3.5 w-14 rounded bg-[var(--bg-muted)]" />
                <div className="h-2.5 w-24 rounded bg-[var(--bg-muted)]" />
              </div>
            </div>
            <div className="h-4 w-4 rounded bg-[var(--bg-muted)]" />
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="h-5 w-20 rounded bg-[var(--bg-muted)]" />
            <div className="h-4 w-12 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Market Table Rows Skeleton
 */
export function MarketTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden animate-fade-in">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2.5 flex items-center justify-between">
        <div className="h-3.5 w-28 rounded bg-[var(--bg-muted)]" />
        <div className="h-3.5 w-16 rounded bg-[var(--bg-muted)]" />
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between skeleton-shimmer">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded bg-[var(--bg-muted)]" />
              <div className="space-y-1">
                <div className="h-3.5 w-20 rounded bg-[var(--bg-muted)]" />
                <div className="h-2.5 w-32 rounded bg-[var(--bg-muted)]" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="h-4 w-16 rounded bg-[var(--bg-muted)] ml-auto" />
              <div className="h-3 w-10 rounded bg-[var(--bg-muted)] ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Candlestick Chart Workspace Skeleton
 */
export function ChartSkeleton() {
  return (
    <div className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-4 skeleton-shimmer animate-fade-in">
      {/* Top Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--bg-muted)]" />
          <div className="space-y-1">
            <div className="h-4 w-28 rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-40 rounded bg-[var(--bg-muted)]" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {['1D', '5D', '1M', '3M', '6M', '1Y'].map((t) => (
            <div key={t} className="h-6 w-8 rounded bg-[var(--bg-muted)]" />
          ))}
        </div>
      </div>

      {/* Main Canvas Chart Area with Faux Gridlines */}
      <div className="relative h-[360px] w-full rounded-lg bg-[var(--bg-subtle)]/50 overflow-hidden flex flex-col justify-between p-4">
        {/* Horizontal faux grid lines */}
        <div className="space-y-12 opacity-30">
          <div className="border-b border-dashed border-[var(--border-subtle)]" />
          <div className="border-b border-dashed border-[var(--border-subtle)]" />
          <div className="border-b border-dashed border-[var(--border-subtle)]" />
          <div className="border-b border-dashed border-[var(--border-subtle)]" />
          <div className="border-b border-dashed border-[var(--border-subtle)]" />
        </div>

        {/* Center Loading Indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <TradexaLoader size={36} />
          <span className="font-mono text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            Rendering Candle Telemetry…
          </span>
        </div>

        {/* Bottom time ticks */}
        <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)]">
          <div className="h-2.5 w-12 rounded bg-[var(--bg-muted)]" />
          <div className="h-2.5 w-12 rounded bg-[var(--bg-muted)]" />
          <div className="h-2.5 w-12 rounded bg-[var(--bg-muted)]" />
          <div className="h-2.5 w-12 rounded bg-[var(--bg-muted)]" />
        </div>
      </div>
    </div>
  );
}

/**
 * News Feed Skeleton
 */
export function NewsFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-2.5 skeleton-shimmer"
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 rounded bg-[var(--bg-muted)]" />
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-full rounded bg-[var(--bg-muted)]" />
            <div className="h-4 w-4/5 rounded bg-[var(--bg-muted)]" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-4 w-12 rounded-full bg-[var(--bg-muted)]" />
            <div className="h-4 w-16 rounded-full bg-[var(--bg-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
