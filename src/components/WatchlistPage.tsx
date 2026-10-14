import { useRef, useState } from 'react';
import { Star, Plus, Search, ArrowUpRight, SlidersHorizontal, RefreshCw, X, ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Quote } from '../types/market';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { useWatchlist } from '../hooks/useWatchlist';
import { formatPrice } from '../utils/format';

const starterSymbols = ['NIFTY50', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY'];
export default function WatchlistPage({ quotes, loading, onSelect, onRefresh, onNews, onAccount, children }: { children?: ReactNode; quotes: Quote[]; loading: boolean; onSelect: (quote: Quote) => void; onRefresh: () => void; onNews: () => void; onAccount: () => void }) {
  const { store, record, symbols: saved } = useWatchlist();
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('saved');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const starter = !saved.length;
  const visibleSymbols = starter ? starterSymbols : saved;
  // Keep saved cards visible when a provider is unavailable. Missing prices are never invented.
  const universe: Quote[] = [...ASSET_BY_SYMBOL.values()].map(asset => quotes.find(q => q.symbol === asset.symbol) ?? { ...asset, price: null, change: null, changePercent: null, volume: null, provider: 'No observation', asOf: null, fetchedAt: null, cached: false, status: 'unavailable', session: { state: 'UNKNOWN', timezone: 'UTC' } });
  const filtered = universe.filter(q => (adding || visibleSymbols.includes(q.symbol)) && (category === 'all' || q.category === category) && `${q.symbol} ${q.name}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'saved' && !adding) return visibleSymbols.indexOf(a.symbol) - visibleSymbols.indexOf(b.symbol);
    if (sort === 'decliners') return (a.changePercent ?? Infinity) - (b.changePercent ?? Infinity);
    if (sort === 'gainers') return (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity);
    return a.symbol.localeCompare(b.symbol);
  });
  async function toggle(symbol: string) {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try { await store.save('user-watchlist', 'watchlist', { symbols: saved.includes(symbol) ? saved.filter(s => s !== symbol) : [...saved, symbol] }, record?.version ?? 0); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your watchlist. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const add = () => { setAdding(true); setCategory('all'); setSearch(''); requestAnimationFrame(() => searchInput.current?.focus()); };
  const resetBrowse = () => { setAdding(false); setSearch(''); setCategory('all'); };
  const price = (q: Quote) => q.price === null ? (loading ? 'Loading…' : 'Unavailable') : formatPrice(q.price, q.currency);
  return <section id="panel-watchlist" aria-labelledby="watchlist-heading" className="watchlist-page space-y-4">
    <header className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
      <h1 id="watchlist-heading" className="text-[28px] leading-tight font-semibold tracking-tight">{adding ? 'Add symbols' : 'Watchlist'}</h1><p className="col-span-2 row-start-2 text-sm leading-6 text-[var(--text-secondary)]">Track stocks. Read news. Study charts.</p>
      {adding ? <button className="icon-button col-start-2 row-start-1 min-h-11 min-w-11" aria-label="Back to watchlist" onClick={resetBrowse}><ArrowLeft size={20} /></button> : <button className="button-primary col-start-2 row-start-1 min-h-11 shrink-0 !px-3" onClick={add}><Plus size={18} /><span>Add symbols</span></button>}
    </header>
    <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
      <span>{adding ? `${filtered.length} instruments` : starter ? 'Starter list · tap a star to save a symbol' : `${saved.length} saved ${saved.length === 1 ? 'symbol' : 'symbols'}`}</span>
      <button className="icon-button !bg-transparent !border-transparent min-h-11 min-w-11" aria-label="Refresh watchlist prices" disabled={loading} onClick={onRefresh}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    <div className="flex items-center gap-2">
      <label className="relative block flex-1 min-w-0"><Search size={18} className="absolute left-3 top-3.5 text-[var(--text-muted)]" /><input ref={searchInput} aria-label="Find watchlist instruments" type="search" className="field min-h-11 !pl-10 block w-full" value={search} onChange={e => setSearch(e.target.value)} placeholder={adding ? 'Search symbols or companies' : 'Search your list'} /></label>
      <details className="relative shrink-0"><summary className="icon-button min-h-11 min-w-11 cursor-pointer list-none" aria-label="Watchlist options"><SlidersHorizontal size={18} /></summary><div className="absolute right-0 top-full mt-2 w-56 z-20 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-lg space-y-3"><label className="block text-xs">Sort by<select className="field block w-full mt-1 min-h-11" value={sort} onChange={e => setSort(e.target.value)}><option value="saved">Saved order</option><option value="name">Name</option><option value="gainers">Biggest gain %</option><option value="decliners">Biggest decline %</option></select></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={comparing} onChange={e => { setComparing(e.target.checked); if (!e.target.checked) setSelected([]); }} />Compare instruments</label><button className="text-sm text-[var(--accent-text)] min-h-11 text-left" onClick={onAccount}>{store.user ? `Account · ${store.user.username}` : 'Sign in to sync devices'}</button></div></details>
    </div>
    {adding && <div className="flex flex-wrap gap-2" aria-label="Instrument categories">{[['all', 'All'], ['india', 'India'], ['us', 'US'], ['crypto', 'Crypto'], ['commodities', 'Metals'], ['forex', 'FX']].map(([id, label]) => <button className={`min-h-11 rounded-lg px-3 text-sm ${category === id ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`} aria-pressed={category === id} key={id} onClick={() => setCategory(id)}>{label}</button>)}</div>}
    {error && <p role="alert" className="research-card text-sm">{error} Your previous saved list is unchanged.</p>}
    {selected.length > 0 && <section className="research-card space-y-3" aria-label="Instrument comparison"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Compare instruments ({selected.length}/3)</h2><button aria-label="Clear comparison" className="icon-button min-h-11 min-w-11" onClick={() => setSelected([])}><X size={18} /></button></div><div className="grid gap-3 sm:grid-cols-3">{selected.map(symbol => universe.find(q => q.symbol === symbol)!).map(q => <article key={q.symbol} className="rounded-lg bg-[var(--bg-subtle)] p-3 text-sm space-y-2"><h3 className="font-semibold">{q.symbol}</h3><p>{price(q)}</p><p>{q.changePercent === null ? 'Change unavailable' : `${q.changePercent.toFixed(2)}%`}</p><p className="text-xs text-[var(--text-secondary)]">{q.provider} · {q.status} · {q.asOf ? new Date(q.asOf).toLocaleString() : 'Time unavailable'}</p><button className="button-secondary min-h-11" onClick={() => onSelect(q)}>Open chart <ArrowUpRight size={16} /></button></article>)}</div><p className="text-xs text-[var(--text-secondary)]">Equity changes use the previous close; crypto uses rolling 24 hours. Currencies and observation times may differ.</p></section>}
    {!filtered.length ? <div className="research-card py-8 text-center space-y-3"><h2 className="font-medium">No symbols found</h2><p className="text-sm text-[var(--text-secondary)]">Try a different search{!adding ? ' or add another stock to your list' : ''}.</p><button className="button-secondary min-h-11" onClick={adding ? () => { setSearch(''); setCategory('all'); } : add}>{adding ? 'Clear filters' : 'Browse symbols'}</button></div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={adding ? 'Available symbols' : 'Watchlist cards'}>
      {filtered.map(q => <article key={q.symbol} aria-label={`${q.symbol} quote`} className="stock-card rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-start gap-1 px-4 pt-3"><button className="flex-1 min-w-0 text-left min-h-11" aria-label={`Open ${q.symbol} chart`} onClick={() => onSelect(q)}><h2 className="text-base font-semibold tracking-tight">{q.symbol}</h2><p className="truncate text-xs text-[var(--text-secondary)]">{q.name}</p></button><button disabled={saving} aria-label={`${saved.includes(q.symbol) ? 'Unsave' : 'Save'} ${q.symbol}`} aria-pressed={saved.includes(q.symbol)} className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg ${saved.includes(q.symbol) ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} onClick={() => void toggle(q.symbol)}><Star size={18} fill={saved.includes(q.symbol) ? 'currentColor' : 'none'} /></button></div>
        <button className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left min-h-12" aria-label={`View ${q.symbol} price details`} onClick={() => onSelect(q)}><span className="text-xl font-semibold tracking-tight tabular-nums">{price(q)}</span><span className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${q.changePercent === null || q.changePercent === 0 ? 'text-[var(--text-secondary)] bg-[var(--bg-subtle)]' : q.changePercent > 0 ? 'text-[var(--gain-text)] bg-[var(--gain-bg)]' : 'text-[var(--loss-text)] bg-[var(--loss-bg)]'}`}>{q.changePercent === null ? '—' : `${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`}</span></button>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-2 text-[11px] text-[var(--text-secondary)]"><span className="capitalize">{q.session.state === 'CLOSED' ? 'Closed · ' : ''}{q.status}{q.cached && q.status !== 'cached' ? ' · cached' : ''}</span><span title={`${q.provider} · ${q.asOf ?? 'No observation'}`}>{q.asOf ? new Date(q.asOf).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : loading ? 'Fetching quote' : 'No price available'}</span></div>
        {comparing && <label className="flex min-h-11 items-center gap-2 px-4 text-xs"><input aria-label={`Compare ${q.symbol}`} type="checkbox" checked={selected.includes(q.symbol)} disabled={selected.length >= 3 && !selected.includes(q.symbol)} onChange={() => setSelected(previous => previous.includes(q.symbol) ? previous.filter(s => s !== q.symbol) : [...previous, q.symbol])} />Compare</label>}
      </article>)}
    </div>}
    {children && !adding && children}
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4"><div><h2 className="text-sm font-semibold">What’s moving the market?</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Read the stories behind the numbers.</p></div><button className="button-secondary min-h-11 shrink-0" onClick={onNews}>News <ArrowUpRight size={16} /></button></div>
    <p className="text-xs leading-5 text-[var(--text-secondary)]">{store.user ? 'Saved to your account.' : 'Your watchlist stays on this device.'}</p>
  </section>;
}
