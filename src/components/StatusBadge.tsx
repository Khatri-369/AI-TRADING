const tones: Record<string, string> = {
  live: 'border-[var(--gain-border)] bg-[var(--gain-bg)] text-[var(--gain-text)]',
  delayed: 'border-[var(--delayed-border)] bg-[var(--delayed-bg)] text-[var(--delayed-text)]',
  cached: 'border-[var(--cached-border)] bg-[var(--cached-bg)] text-[var(--cached-text)]',
  stale: 'border-[var(--stale-border)] bg-[var(--stale-bg)] text-[var(--stale-text)]',
  unavailable: 'border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]',
};

export default function StatusBadge({ status, cached = false }: { status: string; cached?: boolean }) {
  const display = cached && status === 'live' ? 'cached' : status;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        tones[display] ?? tones.unavailable
      }`}
    >
      {display.replaceAll('-', ' ')}
      {cached && display !== 'cached' && display !== 'unavailable' ? ' · cached' : ''}
    </span>
  );
}
