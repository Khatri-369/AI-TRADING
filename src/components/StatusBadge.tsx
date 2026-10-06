const tones: Record<string, string> = {
  live: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  delayed: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  cached: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  stale: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
  unavailable: 'border-slate-600/50 bg-slate-800/60 text-slate-300',
};
export default function StatusBadge({ status, cached = false }: { status: string; cached?: boolean }) {
  const display = cached && status === 'live' ? 'cached' : status;
  return <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${tones[display] ?? tones.unavailable}`}>
    {display.replaceAll('-', ' ')}{cached && display !== 'cached' && display !== 'unavailable' ? ' · cached' : ''}
  </span>;
}
