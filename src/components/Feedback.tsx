import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--stale-border)] bg-[var(--stale-bg)] p-4 text-sm text-[var(--stale-text)]"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words font-medium">{message}</span>
      {onRetry && (
        <button className="button-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

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
      className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]"
    >
      <div className="flex items-center gap-2.5">
        <LoaderCircle className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
        <span className="font-medium text-[var(--text-secondary)]">{label}</span>
        {showTimer && (
          <span className="rounded border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--accent-text)]">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-xs text-[var(--text-muted)] text-center max-w-md">
          {sublabel}
        </span>
      )}
    </div>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-10 text-center">
      <p className="font-medium text-[var(--text-primary)]">{title}</p>
      {detail && (
        <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[var(--text-muted)]">
          {detail}
        </p>
      )}
    </div>
  );
}
