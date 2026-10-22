import { useState } from 'react';
import { Star, ArrowUpRight, X, Plus } from 'lucide-react';
import type { Quote } from '../types/market';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { useResearchStore } from '../hooks/useResearchStore';
import { recordSchemas } from '../../shared/research';
import { formatPrice, formatPercent, isIndexInstrument } from '../utils/format';
import AssetIcon from './AssetIcon';
import { QuoteCardSkeleton } from './Feedback';

const storageKey = 'markets.watchlist.v1';
const RECOMMENDED_INDIAN_STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'];

export default function WatchlistPage({
  quotes,
  loading,
  onSelect,
}: {
  quotes: Quote[];
  loading: boolean;
  onSelect: (quote: Quote) => void;
}) {
  const store = useResearchStore();
  const [legacy] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && ASSET_BY_SYMBOL.has(s)) : [];
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

  const watchlistRecord = store.records.find((r) => r.id === 'user-watchlist' && r.kind === 'watchlist');
  const recordVersion = watchlistRecord?.version ?? 0;

  const parsedWatchlist = recordSchemas.watchlist.safeParse(watchlistRecord?.data);
  const saved = parsedWatchlist.success ? parsedWatchlist.data.symbols : store.user ? [] : legacy;
  const [saving, setSaving] = useState(false);

  const toggle = async (symbol: string) => {
    if (saving) return;
    setSaving(true);
    const next = saved.includes(symbol) ? saved.filter((s) => s !== symbol) : [...saved, symbol];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      await store.save('user-watchlist', 'watchlist', { symbols: next }, recordVersion);
      setStorageError(false);
    } catch {
      setStorageError(true);
    } finally {
      setSaving(false);
    }
  };

  const filtered = quotes
    .filter(
      (q) =>
        (!onlySaved || saved.includes(q.symbol)) &&
        (category === 'all' || q.category === category) &&
        `${q.symbol} ${q.name}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (a.changePercent === null) return b.changePercent === null ? 0 : 1;
      if (b.changePercent === null) return -1;
      return sort === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent;
    });

  const comparison = selected
    .map((symbol) => quotes.find((q) => q.symbol === symbol))
    .filter((q): q is Quote => Boolean(q));

  const displayPrice = (q: Quote) =>
    formatPrice(q.price, q.currency, isIndexInstrument(q.symbol, q.sector, q.currency));

  return (
    <section id="panel-watchlist" aria-labelledby="watchlist-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--accent-text)]">YOUR RESEARCH DESK</p>
          <h1 id="watchlist-heading" className="mt-1 text-2xl font-semibold">
            Watchlist & comparison
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Save instruments on this browser, screen available quotes and compare up to three assets.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          {store.user ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Synced to <strong>@{store.user.username}</strong>
              </span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span>Saved on this browser · Sign in to sync</span>
            </>
          )}
        </div>
      </div>

      {storageError && (
        <p role="alert" className="text-sm text-amber-500">
          Browser storage is unavailable. Your watchlist will last only while this page stays open.
        </p>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 space-y-3 shadow-xs">
        {/* Search input with clean styling */}
        <div className="relative">
          <input
            aria-label="Find watchlist instruments"
            className="field block w-full pl-3 pr-8 py-2 text-xs rounded-lg bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or name (e.g. RELIANCE, BTC, NIFTY50)..."
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Pills (horizontal scroll on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: 'All Markets' },
            { id: 'india', label: 'Indian (NSE/BSE)' },
            { id: 'us', label: 'US Equities' },
            { id: 'crypto', label: 'Crypto' },
            { id: 'commodities', label: 'Commodities' },
            { id: 'forex', label: 'Forex' },
          ].map((cat) => {
            const isCatActive = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer min-h-[32px] ${
                  isCatActive
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Secondary controls row: Sort & Saved Only toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">Sort:</span>
            <select
              className="field py-1 px-2 text-xs rounded-md bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] cursor-pointer"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name (A-Z)</option>
              <option value="gainers">Top Gainers (%)</option>
              <option value="decliners">Top Losers (%)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer text-[var(--text-secondary)] select-none">
            <input
              type="checkbox"
              checked={onlySaved}
              onChange={(e) => setOnlySaved(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--accent-primary)] cursor-pointer"
            />
            <span className="font-medium">Star Saved Only ({saved.length})</span>
          </label>
        </div>
      </div>

      {/* Comparison Drawer / Panel */}
      {selected.length > 0 && (
        <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">Compare instruments ({selected.length}/3)</h2>
            <button
              type="button"
              className="button-secondary min-h-[36px]"
              onClick={() => setSelected([])}
            >
              Clear comparison
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {comparison.map((q) => (
              <article key={q.symbol} className="rounded-lg bg-[var(--bg-subtle)] p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">{q.symbol}</h3>
                  <button
                    aria-label={`Remove ${q.symbol} from comparison`}
                    className="icon-button min-h-[36px] min-w-[36px]"
                    onClick={() => setSelected((s) => s.filter((v) => v !== q.symbol))}
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{q.name}</p>
                <p className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {displayPrice(q)}
                </p>
                <dl className="text-xs space-y-1.5 border-t border-[var(--border-subtle)] pt-2">
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-muted)]">Reported change</dt>
                    <dd
                      className={`font-mono font-medium ${
                        (q.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPercent(q.changePercent)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-muted)]">Status</dt>
                    <dd>{q.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-muted)]">Observed at</dt>
                    <dd>{q.asOf ? new Date(q.asOf).toLocaleTimeString() : 'Unavailable'}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="button-secondary w-full min-h-[44px] mt-2"
                  onClick={() => onSelect(q)}
                >
                  <span>Open chart</span>
                  <ArrowUpRight size={14} />
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        {filtered.length} matching instruments. Crypto typically reports rolling 24h change; equities reflect change from previous official close.
      </p>

      {loading && !quotes.length ? (
        <QuoteCardSkeleton count={6} />
      ) : !filtered.length ? (
        <div className="rounded-xl border border-[var(--border-default)] p-8 text-center space-y-3">
          <h2 className="font-semibold text-base">
            {onlySaved && !saved.length ? 'Build your personal watchlist' : 'No matching instruments'}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            {onlySaved && !saved.length
              ? 'Quickly star Indian benchmark stocks below to track them together.'
              : 'Try clearing your search term or selecting All markets.'}
          </p>

          {onlySaved && !saved.length && (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {RECOMMENDED_INDIAN_STOCKS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => void toggle(sym)}
                  className="button-secondary min-h-[44px] text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add {sym}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((q) => {
            const isGain = (q.changePercent ?? 0) >= 0;
            return (
              <article
                key={q.symbol}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3 shadow-xs hover:border-[var(--border-strong)] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 text-left flex-1 cursor-pointer"
                    onClick={() => onSelect(q)}
                  >
                    <div className="flex items-center gap-1.5">
                      <AssetIcon symbol={q.symbol} category={q.category} size="xs" />
                      <h2 className="font-semibold text-sm text-[var(--text-primary)] hover:text-[var(--accent-text)] transition">
                        {q.symbol}
                      </h2>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {q.sector ?? q.category.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{q.name}</p>
                  </button>
                  <button
                    type="button"
                    aria-label={`${saved.includes(q.symbol) ? 'Unsave' : 'Save'} ${q.symbol}`}
                    aria-pressed={saved.includes(q.symbol)}
                    className="icon-button shrink-0 min-h-[44px] min-w-[44px]"
                    onClick={() => void toggle(q.symbol)}
                  >
                    <Star
                      size={18}
                      className={
                        saved.includes(q.symbol)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-[var(--text-muted)] hover:text-amber-400'
                      }
                    />
                  </button>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-base font-bold tabular-nums text-[var(--text-primary)]">
                    {displayPrice(q)}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      q.changePercent === null
                        ? 'text-[var(--text-muted)]'
                        : isGain
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {formatPercent(q.changePercent)}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-muted)]">
                  {q.provider} · {q.status}
                  <br />
                  {q.asOf ? new Date(q.asOf).toLocaleString() : 'No observation time'}
                </p>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <label className="flex min-h-[44px] items-center gap-2 text-xs cursor-pointer text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${q.symbol}`}
                      checked={selected.includes(q.symbol)}
                      disabled={selected.length >= 3 && !selected.includes(q.symbol)}
                      onChange={() =>
                        setSelected((prev) =>
                          prev.includes(q.symbol)
                            ? prev.filter((s) => s !== q.symbol)
                            : [...prev, q.symbol]
                        )
                      }
                      className="h-4 w-4 rounded accent-[var(--accent-primary)]"
                    />
                    <span>Compare</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => onSelect(q)}
                    className="text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1 min-h-[44px] px-2"
                  >
                    <span>Chart</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
