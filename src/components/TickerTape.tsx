import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import type { Quote } from '../types/market';
import { changeClass, formatPercent, formatPrice } from '../utils/format';

export default function TickerTape({
  quotes,
  loading,
  paused,
  onRefresh,
  onSelect,
}: {
  quotes: Quote[];
  loading: boolean;
  paused: boolean;
  onRefresh: () => void;
  onSelect: (quote: Quote) => void;
}) {
  return (
    <div className="flex min-w-0 items-center border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
      <div className="flex shrink-0 items-center gap-2 border-r border-slate-800/80 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
          {paused ? 'PAUSED' : 'LIVE'}
        </span>
        <button
          className="icon-button h-7 w-7"
          aria-label="Refresh market data"
          title="Refresh market data"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto px-4 py-2" aria-label="Market ticker">
        {quotes.length === 0 ? (
          <span className="text-xs text-slate-400">{loading ? 'Loading market quotes…' : 'No quotes to display'}</span>
        ) : (
          quotes.slice(0, 16).map((quote) => {
            const isPositive = (quote.changePercent ?? 0) >= 0;
            return (
              <button
                key={quote.symbol}
                onClick={() => onSelect(quote)}
                className="group flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1 text-left transition hover:bg-slate-800/60"
                title={`${quote.name} (${quote.symbol})`}
              >
                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">{quote.symbol}</span>
                <span className="font-mono text-xs font-semibold text-slate-100">
                  {formatPrice(quote.price, quote.currency)}
                </span>
                <span className={`flex items-center gap-0.5 font-mono text-[11px] font-medium ${changeClass(quote.changePercent)}`}>
                  {quote.changePercent !== null && (
                    isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                  )}
                  {quote.changePercent === null ? '—' : formatPercent(quote.changePercent)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
