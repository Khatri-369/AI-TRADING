import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Quote } from '../types/market';
import { changeClass, formatPercent, formatPrice } from '../utils/format';

export default function QuoteCard({ quote, onSelect }: { quote: Quote; onSelect: (quote: Quote) => void }) {
  const prevPriceRef = useRef<number | null>(quote.price);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prevPriceRef.current !== null && quote.price !== null && prevPriceRef.current !== quote.price) {
      const direction = quote.price > prevPriceRef.current ? 'up' : 'down';
      setFlash(direction);
      const timer = setTimeout(() => setFlash(null), 800);
      prevPriceRef.current = quote.price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = quote.price;
  }, [quote.price]);

  const isOpen = quote.session.state === 'OPEN';

  return (
    <article
      className={`relative flex min-w-0 flex-col rounded-2xl border p-5 shadow-xl transition-all duration-300 ${
        flash === 'up'
          ? 'border-emerald-500/60 bg-emerald-950/20 shadow-emerald-500/10'
          : flash === 'down'
          ? 'border-rose-500/60 bg-rose-950/20 shadow-rose-500/10'
          : 'border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-black/10 hover:border-indigo-500/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wide text-indigo-300">{quote.symbol}</span>
          {flash && (
            <span
              className={`inline-block h-2 w-2 rounded-full animate-ping ${
                flash === 'up' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isOpen
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border border-slate-700 bg-slate-800/60 text-slate-400'
          }`}
        >
          {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          {quote.session.state}
        </span>
      </div>

      <h3 className="mt-1 truncate text-xs text-slate-400" title={quote.name}>
        {quote.name}
      </h3>

      <div className="my-4">
        <p
          className={`break-words font-mono text-2xl font-bold transition-colors duration-300 ${
            quote.price === null ? 'text-slate-500' : 'text-slate-100'
          } ${flash === 'up' ? '!text-emerald-300' : flash === 'down' ? '!text-rose-300' : ''}`}
        >
          {formatPrice(quote.price, quote.currency)}
        </p>
        <p className={`mt-1 font-mono text-sm font-semibold ${changeClass(quote.changePercent)}`}>
          {formatPercent(quote.changePercent)}
        </p>
      </div>

      <div className="mt-auto border-t border-slate-800/80 pt-3">
        {quote.volume !== null && (
          <p className="mb-3 text-[11px] text-slate-400">
            24h Vol: <span className="font-mono text-slate-300">{Number(quote.volume).toLocaleString(undefined, { notation: 'compact' })}</span>
          </p>
        )}
        {quote.error && <p className="mb-2 text-xs text-amber-300">{quote.error}</p>}
        <button
          className="flex w-full items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
          onClick={() => onSelect(quote)}
          aria-label={`View ${quote.symbol} details`}
        >
          Details & History
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
