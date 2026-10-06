import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { Quote } from '../types/market';
import { changeClass, formatPercent, formatPrice } from '../utils/format';
import QuoteCard from './QuoteCard';
import { Empty, Loading } from './Feedback';

interface Props {
  title: string;
  description: string;
  quotes: Quote[];
  loading: boolean;
  onSelect: (quote: Quote) => void;
  layout?: 'table' | 'cards';
  sectors?: boolean;
}

export default function MarketPanel({
  title,
  description,
  quotes,
  loading,
  onSelect,
  layout = 'table',
  sectors = false,
}: Props) {
  const [filter, setFilter] = useState('all');
  const [sector, setSector] = useState('all');

  const visible = quotes.filter(
    (quote) =>
      (filter === 'all' ||
        (quote.changePercent !== null &&
          (filter === 'gainers' ? quote.changePercent > 0 : quote.changePercent < 0))) &&
      (sector === 'all' || quote.sector === sector)
  );

  const sectorOptions = [...new Set(quotes.flatMap((quote) => (quote.sector ? [quote.sector] : [])))];

  const getSessionBadge = (state: string) => {
    switch (state) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            OPEN
          </span>
        );
      case 'PRE-MARKET':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            PRE-MKT
          </span>
        );
      case 'AFTER-HOURS':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
            AFTER-HRS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            CLOSED
          </span>
        );
    }
  };

  return (
    <section className="panel">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-heading">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <span className="sr-only">{title} movement filter</span>
            <select className="field text-xs py-1.5" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Assets</option>
              <option value="gainers">Gainers</option>
              <option value="losers">Losers</option>
            </select>
          </label>
          {sectors && sectorOptions.length > 0 && (
            <label>
              <span className="sr-only">Sector</span>
              <select className="field text-xs py-1.5" value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="all">All Sectors</option>
                {sectorOptions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading && !quotes.length ? (
        <Loading />
      ) : !visible.length ? (
        <Empty title="No matching assets" detail="Try selecting another filter or sector." />
      ) : layout === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((quote) => (
            <QuoteCard key={quote.symbol} quote={quote} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-900/40">
                <th scope="col" className="px-4 py-3">Asset</th>
                <th scope="col" className="px-4 py-3">Price</th>
                <th scope="col" className="px-4 py-3">24h Change</th>
                <th scope="col" className="px-4 py-3">Volume</th>
                <th scope="col" className="px-4 py-3">Market</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {visible.map((quote) => (
                <tr key={quote.symbol} className="transition hover:bg-slate-800/30">
                  <th scope="row" className="px-4 py-3.5 font-normal">
                    <button
                      className="text-left font-bold text-slate-100 hover:text-indigo-300 transition"
                      onClick={() => onSelect(quote)}
                    >
                      {quote.symbol}
                    </button>
                    <span className="block text-xs text-slate-400 truncate max-w-[180px]">{quote.name}</span>
                  </th>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold text-slate-100">
                    {formatPrice(quote.price, quote.currency)}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3.5 font-mono ${changeClass(quote.changePercent)}`}>
                    <span className="font-semibold">
                      {quote.changePercent === null ? '—' : formatPercent(quote.changePercent)}
                    </span>
                    {quote.change !== null && (
                      <span className="block text-[11px] opacity-80">
                        {quote.change > 0 ? '+' : ''}
                        {quote.change.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                    {quote.volume === null ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      Number(quote.volume).toLocaleString(undefined, { notation: 'compact' })
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {getSessionBadge(quote.session.state)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      className="rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-slate-700/60 px-3 py-1 text-xs font-semibold transition"
                      onClick={() => onSelect(quote)}
                      aria-label={`View ${quote.symbol} details`}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
