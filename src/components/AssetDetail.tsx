import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sparkles, X } from 'lucide-react';
import type { AnalysisEntry, Engine, HistoryRange, Quote } from '../types/market';
import { errorMessage, getHistory } from '../services/api';
import { changeClass, formatPercent, formatPrice, formatTime } from '../utils/format';
import { Empty, ErrorNotice, Loading } from './Feedback';
import AnalysisResult from './AnalysisResult';

interface Props {
  quote: Quote;
  onClose: () => void;
  engine: Engine;
  onEngine: (engine: Engine) => void;
  entry?: AnalysisEntry;
  onAnalyze: () => void;
}

const ranges: HistoryRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y'];

export default function AssetDetail({ quote, onClose, engine, onEngine, entry, onAnalyze }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [range, setRange] = useState<HistoryRange>('1M');
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getHistory>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setHistory(null);
    setError(null);
    void getHistory(quote.symbol, range, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setHistory(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [quote.symbol, range, retry]);

  const chartData = history?.points.map((point) => ({ ...point, timestamp: Date.parse(point.time) })) ?? [];

  return (
    <dialog
      ref={dialog}
      aria-labelledby="asset-detail-title"
      className="asset-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
            onClose();
        }
      }}
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="asset-detail-title" className="text-2xl font-bold">
              {quote.symbol} <span className="text-base font-normal text-slate-400">{quote.name}</span>
            </h2>
          </div>
          <button autoFocus className="icon-button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-6 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="font-mono text-3xl font-bold">{formatPrice(quote.price, quote.currency)}</p>
            <p className={`mt-1 font-mono text-base font-semibold ${changeClass(quote.changePercent)}`}>
              {formatPercent(quote.changePercent)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-0.5 text-xs text-slate-300">
                {quote.session.state}
              </span>
              {quote.sector && (
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs text-indigo-300">
                  {quote.sector}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Metrics</h4>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p className="flex justify-between">
                <span className="text-slate-400">24h Volume:</span>
                <span className="font-mono">{quote.volume !== null ? Number(quote.volume).toLocaleString(undefined, { notation: 'compact' }) : '—'}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="capitalize">{quote.category}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400">Currency:</span>
                <span>{quote.currency}</span>
              </p>
            </div>
          </div>
        </div>

        {quote.error && <ErrorNotice message={quote.error} />}

        <section className="my-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Price Chart</h3>
            <div className="flex flex-wrap gap-1" aria-label="History range">
              {ranges.map((v) => (
                <button
                  key={v}
                  aria-pressed={range === v}
                  onClick={() => setRange(v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    range === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <Loading label={`Loading ${range} chart…`} />
          ) : error ? (
            <div className="mt-4">
              <ErrorNotice message={error} onRetry={() => setRetry((v) => v + 1)} />
            </div>
          ) : history && history.points.length >= 2 ? (
            <div className="mt-5 h-64 min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(val) =>
                      new Date(val).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        ...(range === '1D' ? { hour: '2-digit' as const } : {}),
                      })
                    }
                    stroke="#94a3b8"
                    fontSize={10}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="#94a3b8"
                    fontSize={10}
                    width={65}
                    tickFormatter={(val) =>
                      Number(val).toLocaleString(undefined, { maximumFractionDigits: 2, notation: 'compact' })
                    }
                  />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: 10, color: '#e2e8f0' }}
                    labelFormatter={(val) => formatTime(new Date(Number(val)).toISOString())}
                    formatter={(val) => [formatPrice(Number(val), history.currency), 'Price']}
                  />
                  <Area
                    dataKey="price"
                    type="linear"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4">
              <Empty
                title="Historical data unavailable"
                detail="Not enough historical candles available for this asset/range."
              />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-heading">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              AI Market Assessment
            </h3>
            <label>
              <span className="sr-only">Engine</span>
              <select className="field text-xs py-1.5" value={engine} onChange={(e) => onEngine(e.target.value as Engine)}>
                <option value="gemini">Gemini LLM</option>
                <option value="finbert">FinBERT (NLP)</option>
              </select>
            </label>
          </div>
          {entry?.loading ? (
            <Loading label="Generating AI rating…" />
          ) : entry?.result ? (
            <AnalysisResult result={entry.result} />
          ) : (
            <Empty title="No analysis requested" detail="Click below to generate real-time AI market assessment." />
          )}
          {entry?.error && <ErrorNotice message={entry.error} />}
          <button className="button-primary" disabled={entry?.loading} onClick={onAnalyze}>
            {entry?.loading ? 'Analyzing…' : `Analyze ${quote.symbol} with ${engine === 'gemini' ? 'Gemini' : 'FinBERT'}`}
          </button>
        </section>
      </div>
    </dialog>
  );
}
