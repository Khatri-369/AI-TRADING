import { useState } from 'react';
import { BarChart3, LayoutGrid, List, Loader2 } from 'lucide-react';
import type { Quote } from '../types/market';
import { changeClass, formatPercent, formatPrice, formatTime } from '../utils/format';
import StatusBadge from './StatusBadge';
import QuoteCard from './QuoteCard';
import WatchlistToggle from './WatchlistToggle';
import { Empty, Loading } from './Feedback';

interface Props {
  title: string;
  description: string;
  quotes: Quote[];
  loading: boolean;
  onSelect: (quote: Quote) => void;
  layout?: 'table' | 'cards';
  sectors?: boolean;
  allowLayoutSwitch?: boolean;
}

export default function MarketPanel({
  title,
  description,
  quotes,
  loading,
  onSelect,
  layout = 'table',
  sectors = false,
  allowLayoutSwitch = true,
}: Props) {
  const [filter, setFilter] = useState('all');
  const [sector, setSector] = useState('all');
  const [sort, setSort] = useState('directory');
  const [currentLayout, setCurrentLayout] = useState<'table' | 'cards'>(layout);

  const visible = quotes.filter(
    (quote) =>
      (filter === 'all' ||
        (quote.changePercent !== null &&
          (filter === 'gainers' ? quote.changePercent > 0 : quote.changePercent < 0))) &&
      (sector === 'all' || quote.sector === sector)
  ).sort((a, b) => {
    if (sort === 'name') return a.symbol.localeCompare(b.symbol);
    if (sort === 'directory') return 0;
    const left = sort === 'volume' ? a.volume : a.changePercent;
    const right = sort === 'volume' ? b.volume : b.changePercent;
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return sort === 'decliners' ? left - right : right - left;
  });

  const sectorOptions = [
    ...new Set(quotes.flatMap((quote) => (quote.sector ? [quote.sector] : []))),
  ];

  const getSessionBadge = (state: string) => {
    switch (state) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--gain-border)] bg-[var(--gain-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--gain-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gain-text)]" />
            OPEN
          </span>
        );
      case 'PRE-MARKET':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--delayed-border)] bg-[var(--delayed-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--delayed-text)]">
            PRE-MKT
          </span>
        );
      case 'AFTER-HOURS':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--cached-border)] bg-[var(--cached-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--cached-text)]">
            AFTER-HRS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {state}
          </span>
        );
    }
  };

  return (
    <section className="panel" aria-label={title}>
      {/* Panel Header & Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
        <div>
          <h2 className="section-heading text-base">
            <BarChart3 className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>{title}</span>
            <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
              ({visible.length} of {quotes.length})
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active telemetry updating indicator */}
          {loading && quotes.length > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--accent-text)]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-primary)]" />
              <span>Updating…</span>
            </div>
          )}

          {/* Movement Filter */}
          <label><span className="sr-only">{title} sort order</span><select className="field min-h-11 py-1 text-xs" value={sort} onChange={e => setSort(e.target.value)}><option value="directory">Directory order</option><option value="name">Name A–Z</option><option value="gainers">Biggest gain %</option><option value="decliners">Biggest decline %</option><option value="volume">Highest volume</option></select></label>
          <label>
            <span className="sr-only">{title} movement filter</span>
            <select
              className="field min-h-11 py-1 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Movements</option>
              <option value="gainers">Gainers Only</option>
              <option value="losers">Decliners Only</option>
            </select>
          </label>

          {/* Sector Filter */}
          {sectors && sectorOptions.length > 0 && (
            <label>
              <span className="sr-only">Sector filter</span>
              <select
                className="field min-h-11 py-1 text-xs"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                <option value="all">All Sectors</option>
                {sectorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Layout Toggle */}
          {allowLayoutSwitch && (
            <div className="hidden sm:inline-flex rounded-md border border-[var(--border-default)] p-0.5" role="group" aria-label="Layout view">
              <button
                type="button"
                onClick={() => setCurrentLayout('table')}
                aria-pressed={currentLayout === 'table'}
                className={`rounded p-1 text-xs transition ${
                  currentLayout === 'table'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Table view"
              >
                <List className="h-3.5 w-3.5" />
                <span className="sr-only">Table view</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentLayout('cards')}
                aria-pressed={currentLayout === 'cards'}
                className={`rounded p-1 text-xs transition ${
                  currentLayout === 'cards'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Cards view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="sr-only">Cards view</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && !quotes.length ? (
        <Loading label={`Loading ${title}…`} />
      ) : !visible.length ? (
        <Empty
          title="No matching instruments"
          detail="Adjust your movement or sector filter to view quotes."
        />
      ) : currentLayout === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((quote) => (
            <div key={quote.symbol} className="space-y-2"><QuoteCard quote={quote} onSelect={onSelect} /><WatchlistToggle symbol={quote.symbol} /></div>
          ))}
        </div>
      ) : (
        <>
          {/* Mobile-Native Stock Rows (shown on small screens) */}
          <div className="space-y-2 sm:hidden" role="region" aria-label={`${title} mobile quotes list`}>
            {visible.map((quote) => (
              <div key={quote.symbol} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(quote)}
                className="min-w-0 flex-1 flex items-center justify-between gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-left hover:border-[var(--border-strong)]"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {quote.symbol}
                    </span>
                    {getSessionBadge(quote.session.state)}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)] max-w-[170px]">
                    {quote.name}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    {quote.provider} · {formatTime(quote.asOf)}
                  </p>
                  <StatusBadge status={quote.status} cached={quote.cached} />
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
                    {formatPrice(quote.price, quote.currency)}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center justify-end rounded px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                      (quote.changePercent ?? 0) >= 0
                        ? 'bg-[var(--gain-bg)] text-[var(--gain-text)]'
                        : 'bg-[var(--loss-bg)] text-[var(--loss-text)]'
                    }`}
                  >
                    {quote.changePercent === null ? '—' : formatPercent(quote.changePercent)}
                  </span>
                </div>
              </button>
              <WatchlistToggle symbol={quote.symbol} />
              </div>
            ))}
          </div>

          {/* Dense Analytical Table View (Desktop & Tablet) */}
          <div
            tabIndex={0}
            role="region"
            aria-label={`${title} quotes table`}
            className="hidden sm:block overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          >
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th scope="col" className="px-3.5 py-2.5 font-semibold">Instrument</th>
                <th scope="col" className="px-3.5 py-2.5 font-semibold">Price</th>
                <th scope="col" className="px-3.5 py-2.5 font-semibold">Session Change</th>
                <th scope="col" className="px-3.5 py-2.5 font-semibold">24h Volume</th>
                <th scope="col" className="px-3.5 py-2.5 font-semibold">Market State</th>
                <th scope="col" className="px-3.5 py-2.5 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {visible.map((quote) => (
                <tr
                  key={quote.symbol}
                  className="transition hover:bg-[var(--bg-surface-hover)]"
                >
                  <th scope="row" className="px-3.5 py-3 font-normal">
                    <button
                      type="button"
                      className="text-left font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)] transition"
                      onClick={() => onSelect(quote)}
                    >
                      {quote.symbol}
                    </button>
                    <span className="block max-w-[190px] truncate text-[11px] text-[var(--text-muted)]">
                      {quote.name}
                    </span>
                    {quote.sector && (
                      <span className="inline-block mt-0.5 text-[10px] text-[var(--text-muted)]">
                        {quote.sector}
                      </span>
                    )}
                  </th>
                  <td className="whitespace-nowrap px-3.5 py-3 font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatPrice(quote.price, quote.currency)}
                  </td>
                  <td className={`whitespace-nowrap px-3.5 py-3 font-mono tabular-nums ${changeClass(quote.changePercent)}`}>
                    <span>
                      {quote.changePercent === null ? '—' : formatPercent(quote.changePercent)}
                    </span>
                    {quote.change !== null && (
                      <span className="block text-[10px] opacity-75">
                        {quote.change > 0 ? '+' : ''}
                        {quote.change.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3 font-mono tabular-nums text-[var(--text-secondary)]">
                    {quote.volume === null ? (
                      <span className="text-[var(--text-muted)]">—</span>
                    ) : (
                      Number(quote.volume).toLocaleString(undefined, { notation: 'compact' })
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getSessionBadge(quote.session.state)}
                      <StatusBadge status={quote.status} cached={quote.cached} />
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {quote.provider} · {formatTime(quote.asOf)}
                    </p>
                    {quote.error && (
                      <p className="mt-1 max-w-[200px] text-[10px] text-[var(--delayed-text)]">
                        {quote.error}
                      </p>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex justify-end items-center gap-2"><WatchlistToggle symbol={quote.symbol} />
                    <button
                      type="button"
                      className="button-secondary text-[11px] py-1 px-2.5"
                      onClick={() => onSelect(quote)}
                      aria-label={`View ${quote.symbol} details`}
                    >
                      Research
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
    </section>
  );
}
