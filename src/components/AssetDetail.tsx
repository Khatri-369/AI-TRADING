import { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Bot, Sparkles, X, Table, LineChart as ChartIcon, CandlestickChart } from 'lucide-react';
import type { AnalysisEntry, Engine, HistoryRange, Quote, ThemeType } from '../types/market';
import { errorMessage, getHistory } from '../services/api';
import { changeClass, formatPercent, formatPrice, formatTime, isIndexInstrument } from '../utils/format';
import { Empty, ErrorNotice, Loading } from './Feedback';
import AnalysisResult from './AnalysisResult';
import StatusBadge from './StatusBadge';
import CandleWorkspace from './CandleWorkspace';
import WatchlistToggle from './WatchlistToggle';
import AssetIcon from './AssetIcon';

interface Props {
  quote: Quote;
  onClose: () => void;
  onAsk: () => void;
  onWorkspace: () => void;
  engine: Engine;
  onEngine: (engine: Engine) => void;
  entry?: AnalysisEntry;
  onAnalyze: () => void;
  theme?: ThemeType;
}

const ranges: HistoryRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y'];

export default function AssetDetail({
  quote,
  onClose,
  onAsk,
  onWorkspace,
  engine,
  onEngine,
  entry,
  onAnalyze,
  theme = 'dark',
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [range, setRange] = useState<HistoryRange>('1M');
  const [viewMode, setViewMode] = useState<'chart' | 'candles' | 'table'>('chart');
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

  const chartData =
    history?.points.map((point) => ({
      ...point,
      timestamp: Date.parse(point.time),
    })) ?? [];

  const isDark = theme === 'dark';
  const chartStroke = isDark ? '#3b82f6' : '#1d4ed8';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
  const tooltipText = isDark ? '#f8fafc' : '#0f172a';

  return (
    <dialog
      ref={dialog}
      role="dialog"
      aria-labelledby="asset-detail-title"
      aria-modal="true"
      className="asset-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          ) {
            onClose();
          }
        }
      }}
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button className="button-secondary min-h-[44px]" onClick={onAsk}><Bot size={16} />Ask about {quote.symbol}</button>
              <button className="button-secondary min-h-[44px]" onClick={onWorkspace}><ChartIcon size={16} />Open chart workspace</button>
            </div>
            <div className="flex items-center gap-2.5">
              <AssetIcon symbol={quote.symbol} category={quote.category} size="md" />
              <h2 id="asset-detail-title" className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {quote.symbol}
              </h2>
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {quote.name}
              </span>
              <WatchlistToggle symbol={quote.symbol} compact />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="capitalize">{quote.category} market</span>
              <span>·</span>
              <span>Currency: {quote.currency}</span>
              {quote.sector && (
                <>
                  <span>·</span>
                  <span>Sector: {quote.sector}</span>
                </>
              )}
            </div>
          </div>
          <button
            autoFocus
            className="icon-button min-h-[44px] min-w-[44px]"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-4">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Current Observation
            </span>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatPrice(quote.price, quote.currency, isIndexInstrument(quote.symbol, quote.sector, quote.currency))}
            </p>
            <p className={`mt-0.5 font-mono text-sm tabular-nums ${changeClass(quote.changePercent)}`}>
              {formatPercent(quote.changePercent)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                Session: {quote.session.state}
              </span>
              <StatusBadge status={quote.status} cached={quote.cached} />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Instrument Details & Source
            </h3>
            <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
              <p className="flex justify-between">
                <span className="text-[var(--text-muted)]">24h Volume:</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {quote.volume !== null
                    ? Number(quote.volume).toLocaleString(undefined, { notation: 'compact' })
                    : '—'}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-[var(--text-muted)]">Data Provider:</span>
                <span className="font-medium text-[var(--text-primary)]">{quote.provider}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-[var(--text-muted)]">Source Timestamp:</span>
                <span className="font-mono">{formatTime(quote.asOf)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-[var(--text-muted)]">System Fetched:</span>
                <span className="font-mono">{formatTime(quote.fetchedAt)}</span>
              </p>
            </div>
          </div>
        </div>

        {quote.error && <ErrorNotice message={quote.error} />}
        {quote.session.note && (
          <p className="text-xs text-[var(--text-muted)] italic">
            Schedule: {quote.session.note}
          </p>
        )}

        <section className="my-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Historical Price Data
              </h3>
              <div className="ml-2 inline-flex rounded-md border border-[var(--border-default)] p-0.5" role="group" aria-label="Data display mode">
                <button
                  type="button"
                  onClick={() => setViewMode('chart')}
                  aria-pressed={viewMode === 'chart'}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                    viewMode === 'chart'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Display graphical chart"
                >
                  <ChartIcon className="h-3.5 w-3.5" />
                  <span>Chart</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('candles')}
                  aria-pressed={viewMode === 'candles'}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                    viewMode === 'candles'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Display interactive candlestick chart with drawing tools"
                >
                  <CandlestickChart className="h-3.5 w-3.5" />
                  <span>Candles</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-pressed={viewMode === 'table'}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
                    viewMode === 'table'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Display accessible data table"
                >
                  <Table className="h-3.5 w-3.5" />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {viewMode !== 'candles' && (
              <div className="flex flex-wrap gap-1" aria-label="History time range selector">
                {ranges.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={range === v}
                    onClick={() => setRange(v)}
                    className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                      range === v
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>

          {viewMode === 'candles' ? (
            <div className="mt-4">
              <CandleWorkspace
                symbol={quote.symbol}
                theme={theme}
                onPlan={onWorkspace}
              />
            </div>
          ) : loading ? (
            <Loading
              showTimer
              label={`Loading ${range} historical candle observations…`}
              sublabel={`Connecting to ${quote.provider} historical feed…`}
            />
          ) : error ? (
            <div className="mt-4">
              <ErrorNotice message={error} onRetry={() => setRetry((v) => v + 1)} />
            </div>
          ) : history && history.points.length >= 2 ? (
            viewMode === 'chart' ? (
              <div className="mt-4 h-64 min-w-0 w-full" tabIndex={0} aria-label={`${quote.symbol} ${range} price chart`}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartStroke} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={chartStroke} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={gridStroke} />
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
                      stroke={axisColor}
                      fontSize={11}
                      minTickGap={40}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke={axisColor}
                      fontSize={11}
                      width={65}
                      tickFormatter={(val) =>
                        Number(val).toLocaleString(undefined, { maximumFractionDigits: 2, notation: 'compact' })
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: 8,
                        color: tooltipText,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      labelFormatter={(val) => formatTime(new Date(Number(val)).toISOString())}
                      formatter={(val) => [formatPrice(Number(val), history.currency), 'Price']}
                    />
                    <Area
                      dataKey="price"
                      type="linear"
                      stroke={chartStroke}
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label={`${quote.symbol} historical price table data alternative`}
                className="mt-4 max-h-64 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]"
              >
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    {quote.symbol} {range} historical observations data table
                  </caption>
                  <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Timestamp</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Price ({history.currency})</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-right">Relative Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {history.points.map((pt, idx) => {
                      const prevPt = idx > 0 ? history.points[idx - 1] : null;
                      const diff = prevPt && pt.price !== null && prevPt.price !== null ? pt.price - prevPt.price : null;
                      const diffPct = prevPt && pt.price !== null && prevPt.price && prevPt.price !== 0 ? (diff! / prevPt.price) * 100 : null;
                      return (
                        <tr key={pt.time} className="hover:bg-[var(--bg-surface-hover)]">
                          <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">
                            {formatTime(pt.time)}
                          </td>
                          <td className="px-3 py-1.5 font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                            {formatPrice(pt.price, history.currency)}
                          </td>
                          <td className={`px-3 py-1.5 font-mono tabular-nums text-right ${changeClass(diffPct)}`}>
                            {diffPct !== null ? `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="mt-4">
              <Empty
                title="Historical data unavailable"
                detail={history?.error ?? 'Not enough historical candles available for this asset/range.'}
              />
            </div>
          )}

          {viewMode !== 'candles' && history && (
            <p className="mt-3 text-[11px] text-[var(--text-muted)]">
              {history.provider} · {history.status.toUpperCase()} · Fetched: {formatTime(history.fetchedAt)} ·{' '}
              {history.points.length} observations{history.error ? ` · ${history.error}` : ''}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-heading text-sm">
              <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
              AI Market Assessment
            </h3>
            <label className="flex items-center gap-2">
              <span className="sr-only">Analysis Engine</span>
              <select
                className="field py-1 text-xs"
                value={engine}
                onChange={(e) => onEngine(e.target.value as Engine)}
              >
                <option value="gemini">Gemini LLM</option>
                <option value="finbert">FinBERT (NLP)</option>
              </select>
            </label>
          </div>

          {entry?.loading ? (
            <Loading
              showTimer
              label={`Generating ${engine === 'gemini' ? 'Gemini LLM' : 'FinBERT NLP'} structured rating…`}
              sublabel="Synthesizing multi-timeframe price action, volatility and real-time news…"
            />
          ) : entry?.result ? (
            <AnalysisResult result={entry.result} />
          ) : (
            <Empty
              title="No assessment requested"
              detail="Click below to generate on-demand AI analysis based on current provider evidence."
            />
          )}

          {entry?.error && <ErrorNotice message={entry.error} />}

          <button
            className="button-primary text-xs"
            disabled={entry?.loading}
            onClick={onAnalyze}
          >
            {entry?.loading
              ? 'Analyzing…'
              : `Analyze ${quote.symbol} with ${engine === 'gemini' ? 'Gemini' : 'FinBERT'}`}
          </button>
        </section>
      </div>
    </dialog>
  );
}
