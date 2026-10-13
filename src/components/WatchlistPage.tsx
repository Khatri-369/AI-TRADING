import { useEffect, useState } from 'react';
import { Star, ArrowUpRight, X } from 'lucide-react';
import type { Quote } from '../types/market';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { useResearchStore } from '../hooks/useResearchStore';
import { recordSchemas } from '../../shared/research';

const storageKey = 'markets.watchlist.v1';

export default function WatchlistPage({ quotes, loading, onSelect }: { quotes: Quote[]; loading: boolean; onSelect: (quote: Quote) => void }) {
  const store = useResearchStore();
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) ? [...new Set(value.filter((s): s is string => typeof s === 'string' && ASSET_BY_SYMBOL.has(s)))] : [];
    } catch {
      return [];
    }
  });
  const [storageError, setStorageError] = useState(false);
  const [search, setSearch] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('name');
  const [selected, setSelected] = useState<string[]>([]);

  const watchlistRecord = store.records.find(r => r.id === 'user-watchlist' && r.kind === 'watchlist');
  const recordVersion = watchlistRecord?.version ?? 0;

  // Sync cloud watchlist when record arrives or updates
  useEffect(() => {
    if (!watchlistRecord) return;
    const parsed = recordSchemas.watchlist.safeParse(watchlistRecord.data);
    if (!parsed.success) return;
    const cloudSymbols = parsed.data.symbols.filter(s => ASSET_BY_SYMBOL.has(s));
    setSaved(prev => {
      const combined = [...new Set([...prev, ...cloudSymbols])];
      if (combined.length !== prev.length || !cloudSymbols.every(s => prev.includes(s))) {
        try { localStorage.setItem(storageKey, JSON.stringify(combined)); } catch { /* ignore */ }
        return combined;
      }
      return prev;
    });
  }, [watchlistRecord]);

  // Keep localStorage updated with user's saved list
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [saved]);

  const toggle = async (symbol: string) => {
    const next = saved.includes(symbol)
      ? saved.filter(s => s !== symbol)
      : [...saved, symbol];
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    try {
      await store.save('user-watchlist', 'watchlist', { symbols: next }, recordVersion);
    } catch {
      // Local fallback remains fully intact even if unauthenticated or offline
    }
  };

  const filtered = quotes.filter(q => (!onlySaved || saved.includes(q.symbol)) && (category === 'all' || q.category === category) && `${q.symbol} ${q.name}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (a.changePercent === null) return b.changePercent === null ? 0 : 1;
    if (b.changePercent === null) return -1;
    return sort === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent;
  });

  const comparison = selected.map(symbol => quotes.find(q => q.symbol === symbol)).filter((q): q is Quote => Boolean(q));
  const price = (q: Quote) => q.price === null ? 'Unavailable' : `${q.currency} ${q.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

  return (
    <section id="panel-watchlist" aria-labelledby="watchlist-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--accent-text)]">YOUR RESEARCH DESK</p>
          <h1 id="watchlist-heading" className="mt-1 text-2xl font-semibold">Watchlist & comparison</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Save instruments on this browser, screen available quotes and compare up to three assets.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          {store.user ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Synced to <strong>@{store.user.username}</strong></span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span>Saved on this browser · Sign in to sync</span>
            </>
          )}
        </div>
      </div>

      {storageError && <p role="alert" className="text-sm text-amber-500">Browser storage is unavailable. Your watchlist will last only while this page stays open.</p>}

      <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <label className="text-xs grow">Find instruments<input aria-label="Find watchlist instruments" className="field mt-1 block w-full" value={search} onChange={e => setSearch(e.target.value)} placeholder="Symbol or company name" /></label>
        <label className="text-xs">Market<select className="field mt-1 block" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All markets</option>{['india', 'us', 'crypto', 'commodities', 'forex'].map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></label>
        <label className="text-xs">Sort by<select className="field mt-1 block" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name</option><option value="gainers">Largest change %</option><option value="decliners">Smallest change %</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlySaved} onChange={e => setOnlySaved(e.target.checked)} />Saved only ({saved.length})</label>
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Compare instruments ({selected.length}/3)</h2>
            <button className="button-secondary" onClick={() => setSelected([])}>Clear comparison</button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {comparison.map(q => (
              <article key={q.symbol} className="rounded-lg bg-[var(--bg-subtle)] p-4 space-y-2">
                <div className="flex justify-between">
                  <h3 className="font-semibold">{q.symbol}</h3>
                  <button aria-label={`Remove ${q.symbol} from comparison`} className="icon-button" onClick={() => setSelected(s => s.filter(v => v !== q.symbol))}><X size={14} /></button>
                </div>
                <p className="text-sm">{q.name}</p>
                <p className="text-xl font-semibold">{price(q)}</p>
                <dl className="text-xs space-y-2">
                  <div><dt className="text-[var(--text-muted)]">Reported change</dt><dd>{q.changePercent === null ? 'Unavailable' : `${q.changePercent.toFixed(2)}%`}</dd></div>
                  <div><dt className="text-[var(--text-muted)]">Source / freshness</dt><dd>{q.provider} · {q.status}</dd></div>
                  <div><dt className="text-[var(--text-muted)]">Observed at</dt><dd>{q.asOf ? new Date(q.asOf).toLocaleString() : 'Unavailable'}</dd></div>
                  <div><dt className="text-[var(--text-muted)]">Session</dt><dd>{q.session.state}</dd></div>
                </dl>
                <button className="button-secondary" onClick={() => onSelect(q)}>Open chart <ArrowUpRight size={14} /></button>
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">{filtered.length} matching instruments. Changes use each provider’s reporting period: crypto typically uses rolling 24 hours; equities use the previous close. Currencies, units and observation times can differ.</p>

      {loading && !quotes.length ? (
        <p role="status">Loading market quotes…</p>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-[var(--border-default)] p-8 text-center">
          <h2 className="font-medium">{onlySaved && !saved.length ? 'Build your first watchlist' : 'No matching instruments'}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{onlySaved && !saved.length ? 'Turn off Saved only and use the star next to an instrument.' : 'Try another search or market filter.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(q => (
            <article key={q.symbol} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => onSelect(q)}>
                  <h2 className="font-semibold">{q.symbol}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">{q.name}</p>
                </button>
                <button aria-label={`${saved.includes(q.symbol) ? 'Unsave' : 'Save'} ${q.symbol}`} aria-pressed={saved.includes(q.symbol)} className="icon-button shrink-0" onClick={() => void toggle(q.symbol)}>
                  <Star size={18} fill={saved.includes(q.symbol) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{price(q)}</span>
                <span className="text-sm">{q.changePercent === null ? '—' : `${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{q.provider} · {q.status}<br />{q.asOf ? new Date(q.asOf).toLocaleString() : 'No observation time'}</p>
              <label className="flex min-h-8 items-center gap-2 text-xs">
                <input type="checkbox" aria-label={`Compare ${q.symbol}`} checked={selected.includes(q.symbol)} disabled={selected.length >= 3 && !selected.includes(q.symbol)} onChange={() => setSelected(previous => previous.includes(q.symbol) ? previous.filter(s => s !== q.symbol) : [...previous, q.symbol])} />
                Compare instrument
              </label>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
