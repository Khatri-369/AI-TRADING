import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';

export default function WatchlistToggle({ symbol }: { symbol: string }) {
  const { store, record, symbols } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const saved = symbols.includes(symbol);
  async function toggle() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await store.save('user-watchlist', 'watchlist', { symbols: saved ? symbols.filter(s => s !== symbol) : [...symbols, symbol] }, record?.version ?? 0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Watchlist could not be saved.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="shrink-0"><button className="icon-button min-h-11 min-w-11" aria-label={`${saved ? 'Remove' : 'Save'} ${symbol} ${saved ? 'from' : 'to'} watchlist`} aria-pressed={saved} disabled={busy || !store.sessionReady} onClick={() => void toggle()}><Star size={18} className={saved ? 'fill-current text-[var(--accent-text)]' : ''} /></button>{error && <p role="alert" className="max-w-48 text-xs text-[var(--loss-text)]">{error}</p>}</div>;
}
