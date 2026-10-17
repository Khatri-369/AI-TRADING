import type { ChatFocus } from '../../shared/chat';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { getCandles } from '../services/api';
import { chartLayoutSchema, movingAverage, type Drawing } from '../../shared/research';
import { useResearchStore } from '../hooks/useResearchStore';
import type { HistoryRange, ThemeType } from '../types/market';

export interface PlanLevels {
  entry?: number;
  stop?: number;
  target?: number;
  direction?: 'long' | 'short';
}

export default function CandleWorkspace({
  symbol,
  theme,
  onPlan,
  onAsk,
  onAlert,
  planLevels,
  onPlanLevelChange,
}: {
  symbol: string;
  theme: ThemeType;
  onPlan?: (levels?: { entry?: number; stop?: number; target?: number; direction?: 'long' | 'short' }) => void;
  onAsk?: (focus: ChatFocus) => void;
  onAlert?: (level: number) => void;
  planLevels?: PlanLevels;
  onPlanLevelChange?: (levelType: 'entry' | 'stop' | 'target', price: number) => void;
}) {
  const store = useResearchStore();
  const [interval, setInterval] = useState<'5m' | '30m' | '1d'>('1d');
  const [range, setRange] = useState<HistoryRange>('1M');
  const [data, setData] = useState<Awaited<ReturnType<typeof getCandles>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<'navigate' | 'edit' | 'plan' | Drawing['type']>(
    planLevels ? 'plan' : 'navigate'
  );
  const [text, setText] = useState('Key Level');
  const [name, setName] = useState('Default');
  const [layoutId, setLayoutId] = useState(`chart-${symbol}-default`);
  const [version, setVersion] = useState(0);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState('');
  const [undo, setUndo] = useState<Drawing[][]>([]);
  const [redo, setRedo] = useState<Drawing[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [table, setTable] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    changePercent: number;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('last_chart_symbol', symbol);
      localStorage.setItem('last_chart_interval', interval);
    } catch {
      // Ignore
    }
  }, [symbol, interval]);

  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const drawingRef = useRef(drawings);
  drawingRef.current = drawings;
  const pending = useRef<Drawing['a'] | null>(null);
  const drag = useRef<{ id: string; anchor: 'a' | 'b'; previous: Drawing[] } | null>(null);
  const planDrag = useRef<{ level: 'entry' | 'stop' | 'target' } | null>(null);
  const planLevelsRef = useRef(planLevels);
  planLevelsRef.current = planLevels;
  const onPlanLevelChangeRef = useRef(onPlanLevelChange);
  onPlanLevelChangeRef.current = onPlanLevelChange;
  const loaded = useRef('');

  // Synchronize layout with stored records
  useEffect(() => {
    const identity = `${store.user?.id ?? 'guest'}:${layoutId}`;
    const record = store.records.find((r) => r.id === layoutId && r.kind === 'chart');
    if (loaded.current === identity && (dirty || version === (record?.version ?? 0))) return;
    loaded.current = identity;
    const parsed = chartLayoutSchema.safeParse(record?.data);
    setDrawings(parsed.success ? parsed.data.drawings : []);
    setVersion(record?.version ?? 0);
    setName(parsed.success ? parsed.data.name : 'Default');
    if (parsed.success) setInterval(parsed.data.interval);
    setDirty(false);
    setUndo([]);
    setRedo([]);
  }, [store.records, store.user?.id, layoutId, dirty, version]);

  const commit = (next: Drawing[]) => {
    setUndo((previous) => [...previous.slice(-29), drawingRef.current]);
    setRedo([]);
    setDrawings(next);
    setError('');
    setDirty(true);
  };

  const layouts = store.records.filter(
    (r) =>
      r.kind === 'chart' &&
      chartLayoutSchema.safeParse(r.data).success &&
      chartLayoutSchema.parse(r.data).symbol === symbol
  );

  // Fetch real OHLCV candles
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    void getCandles(symbol, interval, range, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [symbol, interval, range]);

  const saving = useRef(false);
  const revision = JSON.stringify({ layoutId, symbol, name, interval, drawings });
  const latestRevision = useRef(revision);
  latestRevision.current = revision;
  const save = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    const savedRevision = revision;
    try {
      await store.save(layoutId, 'chart', { symbol, name, interval, drawings }, version);
      if (latestRevision.current === savedRevision) setDirty(false);
      if (JSON.parse(latestRevision.current).layoutId === layoutId) setVersion(v => v + 1);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save layout.');
    } finally { saving.current = false; }
  }, [store, layoutId, symbol, name, interval, drawings, version, revision]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty || error) return;
    const timer = setTimeout(() => {
      void save();
    }, 1200);
    return () => clearTimeout(timer);
  }, [drawings, name, dirty, save, error]);

  // Lightweight Charts rendering
  useEffect(() => {
    if (!host.current || !data?.candles.length || table) return;
    const dark = theme === 'dark';
    const api = createChart(host.current, {
      autoSize: true,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: dark ? '#0f172a' : '#ffffff' },
        textColor: dark ? '#cbd5e1' : '#334155',
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: dark ? '#1e293b' : '#f1f5f9' },
        horzLines: { color: dark ? '#1e293b' : '#f1f5f9' },
      },
      timeScale: {
        timeVisible: interval !== '1d',
      },
      rightPriceScale: {
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      crosshair: {
        vertLine: {
          color: dark ? '#475569' : '#94a3b8',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: dark ? '#475569' : '#94a3b8',
          width: 1,
          style: 3,
        },
      },
    });

    const candles = api.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candles.setData(data.candles.map((c) => ({ ...c, time: (Date.parse(c.time) / 1000) as UTCTimestamp })));

    const volume = api.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      data.candles
        .filter((c) => c.volume !== null)
        .map((c) => ({
          time: (Date.parse(c.time) / 1000) as UTCTimestamp,
          value: c.volume!,
          color: c.close >= c.open ? '#10b98155' : '#ef444455',
        }))
    );

    // SMA 20 (blue) and EMA 20 (amber)
    for (const [exponential, color] of [
      [false, '#3b82f6'],
      [true, '#f59e0b'],
    ] as const) {
      const line = api.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(
        movingAverage(data.candles, 20, exponential).map((p) => ({
          time: (Date.parse(p.time) / 1000) as UTCTimestamp,
          value: p.value,
        }))
      );
    }

    // Subscribe to crosshair movement to feed HUD
    api.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }
      const bar = param.seriesData.get(candles) as
        | { open?: number; high?: number; low?: number; close?: number }
        | undefined;
      const volBar = param.seriesData.get(volume) as { value?: number } | undefined;
      if (bar && bar.open !== undefined && bar.close !== undefined && bar.high !== undefined && bar.low !== undefined) {
        const chg = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
        setHoveredCandle({
          time: typeof param.time === 'number' ? new Date(param.time * 1000).toLocaleString() : String(param.time),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: volBar?.value ?? null,
          changePercent: chg,
        });
      }
    });

    api.timeScale().fitContent();
    chart.current = api;
    series.current = candles;

    let frame = 0;
    function paint() {
      const canvas = overlay.current;
      if (!canvas || !host.current) return;
      const width = host.current.clientWidth;
      const height = host.current.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (const d of drawingRef.current) {
        const ax = api.timeScale().timeToCoordinate(d.a.time as UTCTimestamp);
        const ay = candles.priceToCoordinate(d.a.price);
        const bx = d.b ? api.timeScale().timeToCoordinate(d.b.time as UTCTimestamp) : ax;
        const by = d.b ? candles.priceToCoordinate(d.b.price) : ay;
        if (ax === null || ay === null || bx === null || by === null) continue;

        ctx.strokeStyle = '#8b5cf6';
        ctx.fillStyle = '#8b5cf622';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (d.type === 'level') {
          ctx.moveTo(0, ay);
          ctx.lineTo(width - 65, ay);
        }
        if (d.type === 'trend') {
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
        }
        if (d.type === 'zone') {
          ctx.rect(ax, ay, bx - ax, by - ay);
          ctx.fill();
        }
        ctx.stroke();

        ctx.fillStyle = dark ? '#c4b5fd' : '#6d28d9';
        ctx.font = '12px system-ui, sans-serif';
        if (d.type === 'text') ctx.fillText(d.text, ax, ay);
        if (d.type === 'level') ctx.fillText(d.a.price.toFixed(2), 8, ay - 6);
        if (!d.locked) {
          ctx.fillRect(ax - 4, ay - 4, 8, 8);
          if (d.b) ctx.fillRect(bx - 4, by - 4, 8, 8);
        }
      }

      // Render interactive trade plan levels if present
      if (planLevelsRef.current) {
        const { entry, stop, target } = planLevelsRef.current;
        const levels = [
          { key: 'entry', price: entry, label: 'ENTRY', stroke: '#0284c7', fill: '#0284c7' },
          { key: 'stop', price: stop, label: 'STOP (INVALIDATION)', stroke: '#e11d48', fill: '#e11d48' },
          { key: 'target', price: target, label: 'TARGET', stroke: '#059669', fill: '#059669' },
        ] as const;

        for (const item of levels) {
          if (!item.price || item.price <= 0) continue;
          const py = candles.priceToCoordinate(item.price);
          if (py === null || py < 0 || py > height) continue;

          // Horizontal dashed line
          ctx.strokeStyle = item.stroke;
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(width - 65, py);
          ctx.stroke();
          ctx.setLineDash([]);

          // Right badge
          const badgeText = `${item.label}: ${item.price.toFixed(2)}`;
          ctx.font = 'bold 11px system-ui, sans-serif';
          const textMetrics = ctx.measureText(badgeText);
          const badgeWidth = textMetrics.width + 16;
          const badgeX = Math.max(8, width - 80 - badgeWidth);
          const badgeY = py - 10;

          ctx.fillStyle = item.fill;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(badgeX, badgeY, badgeWidth, 20, 4);
          } else {
            ctx.rect(badgeX, badgeY, badgeWidth, 20);
          }
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(badgeText, badgeX + 8, py + 4);

          // Draggable handle grip knob
          ctx.fillStyle = item.fill;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(width - 72, py, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      frame = requestAnimationFrame(paint);
    }
    frame = requestAnimationFrame(paint);

    return () => {
      cancelAnimationFrame(frame);
      api.remove();
      chart.current = null;
      series.current = null;
    };
  }, [data, theme, table, interval]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = chart.current?.timeScale().coordinateToTime(x);
    const price = series.current?.coordinateToPrice(y);
    return typeof time === 'number' && price && price > 0 ? { time, price } : null;
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(event);
    if (!p) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickY = event.clientY - rect.top;

    // Check hit on draggable plan levels
    if (
      onPlanLevelChangeRef.current &&
      planLevelsRef.current &&
      (tool === 'plan' || tool === 'edit' || tool === 'navigate')
    ) {
      const { entry, stop, target } = planLevelsRef.current;
      const levels = [
        { key: 'entry' as const, price: entry },
        { key: 'stop' as const, price: stop },
        { key: 'target' as const, price: target },
      ];
      for (const item of levels) {
        if (!item.price || item.price <= 0) continue;
        const py = series.current?.priceToCoordinate(item.price);
        if (py != null && Math.abs(clickY - py) < 16) {
          planDrag.current = { level: item.key };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }
    }

    if (tool === 'edit') {
      for (const d of [...drawings].reverse())
        for (const anchor of ['a', 'b'] as const) {
          const a = d[anchor];
          if (!a || d.locked) continue;
          const x = chart.current?.timeScale().timeToCoordinate(a.time as UTCTimestamp);
          const y = series.current?.priceToCoordinate(a.price);
          if (
            x != null &&
            y != null &&
            Math.hypot(event.clientX - rect.left - x, event.clientY - rect.top - y) < 24
          ) {
            drag.current = { id: d.id, anchor, previous: drawings };
            setSelected(d.id);
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }
        }
      return;
    }
    if (tool === 'navigate' || tool === 'plan' || drawings.length >= 50) return;
    if ((tool === 'trend' || tool === 'zone') && !pending.current) {
      pending.current = p;
      setError('Tap the second point on chart to complete the drawing.');
      return;
    }
    const d: Drawing = {
      id: crypto.randomUUID(),
      type: tool,
      a: pending.current ?? p,
      ...(pending.current ? { b: p } : {}),
      text,
      locked: false,
    };
    pending.current = null;
    commit([...drawings, d]);
    setSelected(d.id);
    setError('');
  }

  async function exportImage() {
    const screenshot = chart.current?.takeScreenshot();
    if (!screenshot || !overlay.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = screenshot.width;
    canvas.height = screenshot.height + 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(screenshot, 0, 0);
    ctx.drawImage(overlay.current, 0, 0, screenshot.width, screenshot.height);

    ctx.fillStyle = theme === 'dark' ? '#fff' : '#111';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(
      `${symbol} · ${data?.exchange ?? ''} · ${interval} · ${data?.currency} · ${data?.provider} · ${data?.status}`,
      12,
      screenshot.height + 30
    );
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = theme === 'dark' ? '#94a3b8' : '#64748b';
    ctx.fillText(
      `Exported ${new Date().toISOString()} · Charts by TradingView (Apache 2.0)`,
      12,
      screenshot.height + 60
    );

    const link = document.createElement('a');
    link.download = `${symbol}-${interval}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  const chosen = drawings.find((d) => d.id === selected);
  const latestCandle = data?.candles.length ? data.candles[data.candles.length - 1] : null;
  const displayBar =
    hoveredCandle ??
    (latestCandle
      ? {
          time: new Date(latestCandle.time).toLocaleString(),
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
          volume: latestCandle.volume,
          changePercent:
            latestCandle.open > 0 ? ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100 : 0,
        }
      : null);

  return (
    <div
      ref={root}
      className={
        isExpanded
          ? 'fixed inset-0 z-50 bg-[var(--bg-canvas)] p-3 sm:p-4 flex flex-col h-full w-full overflow-y-auto space-y-3'
          : 'space-y-3 bg-[var(--bg-surface)] p-3 sm:p-4 rounded-xl border border-[var(--border-default)]'
      }
    >
      {/* Header & Instrument Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-base text-[var(--text-primary)]">{symbol}</h3>
          {data?.exchange && (
            <span className="rounded bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {data.exchange}
            </span>
          )}
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {interval === '1d' ? '1D Daily' : `${interval} Intraday`}
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-xs text-[var(--text-secondary)]">{data?.currency ?? 'INR'}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-xs text-[var(--text-muted)]">{data?.timezone ?? 'Asia/Kolkata'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">
            Source: <strong className="text-[var(--text-primary)]">{data?.provider ?? 'Provider'}</strong>
          </span>
          {data && (
            <span className="rounded px-2 py-0.5 text-[10px] uppercase font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
              {data.status}
            </span>
          )}
        </div>
      </div>

      {/* Crosshair / Latest Candle Values HUD */}
      {displayBar && !table && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--bg-surface-elevated)] px-3 py-1.5 font-mono text-xs tabular-nums border border-[var(--border-subtle)]">
          <span className="text-[var(--text-muted)] text-[11px]">{displayBar.time}</span>
          <span>
            O: <strong className="text-[var(--text-primary)]">{displayBar.open.toFixed(2)}</strong>
          </span>
          <span>
            H: <strong className="text-[var(--text-primary)]">{displayBar.high.toFixed(2)}</strong>
          </span>
          <span>
            L: <strong className="text-[var(--text-primary)]">{displayBar.low.toFixed(2)}</strong>
          </span>
          <span>
            C: <strong className="text-[var(--text-primary)]">{displayBar.close.toFixed(2)}</strong>
          </span>
          {displayBar.volume !== null && (
            <span>
              Vol:{' '}
              <strong className="text-[var(--text-primary)]">{displayBar.volume.toLocaleString()}</strong>
            </span>
          )}
          <span
            className={
              displayBar.changePercent >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'
            }
          >
            {displayBar.changePercent >= 0 ? '+' : ''}
            {displayBar.changePercent.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Primary Toolbar: Intervals, Ranges, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[var(--bg-surface-elevated)] p-2.5 border border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="candle-interval-select" className="text-xs font-medium text-[var(--text-secondary)]">
              Interval:
            </label>
            <select
              id="candle-interval-select"
              aria-label="Candle interval"
              className="field text-xs font-semibold py-1 px-2 rounded-lg bg-[var(--bg-surface)] border-[var(--border-default)] cursor-pointer"
              value={interval}
              onChange={(e) => {
                const next = e.target.value as typeof interval;
                setInterval(next);
                if (next !== '1d' && ['3M', '6M', '1Y'].includes(range)) setRange('1M');
              }}
            >
              <option value="5m">5m Intraday</option>
              <option value="30m">30m Intraday</option>
              <option value="1d">Daily (1D)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="candle-range-select" className="text-xs font-medium text-[var(--text-secondary)]">
              Range:
            </label>
            <select
              id="candle-range-select"
              aria-label="Candle range"
              className="field text-xs font-semibold py-1 px-2 rounded-lg bg-[var(--bg-surface)] border-[var(--border-default)] cursor-pointer"
              value={range}
              onChange={(e) => setRange(e.target.value as HistoryRange)}
            >
              {(interval === '1d' ? ['1M', '3M', '6M', '1Y'] : ['1D', '5D', '1M']).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="button-secondary text-xs py-1.5 px-2.5 min-h-[34px] cursor-pointer"
            onClick={() => chart.current?.timeScale().fitContent()}
          >
            Reset view
          </button>
          <button
            type="button"
            className="button-secondary text-xs py-1.5 px-2.5 min-h-[34px] flex items-center gap-1.5 cursor-pointer"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? 'Exit full screen' : 'Full screen'}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isExpanded ? 'Exit full screen' : 'Full screen'}</span>
          </button>
          <button
            type="button"
            className="button-secondary text-xs py-1.5 px-2.5 min-h-[34px] cursor-pointer"
            onClick={() => setTable((v) => !v)}
          >
            {table ? 'Show candles' : 'Candle table'}
          </button>
          <button
            type="button"
            className="button-secondary text-xs py-1.5 px-2.5 min-h-[34px] cursor-pointer"
            disabled={!data?.candles.length || table}
            onClick={() => void exportImage()}
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Touch Gesture & Drawing Mode Separator Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface-elevated)] p-2 border border-[var(--border-subtle)] text-xs">
        <div className="flex items-center gap-2">
          {tool === 'navigate' ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-blue-400">
              <span>✋ Navigation Mode</span>
              <span className="text-[11px] text-[var(--text-muted)] font-normal">
                (Pan & pinch-to-zoom enabled)
              </span>
            </span>
          ) : tool === 'plan' ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-sky-400">
              <span>🎯 Plan Levels Mode</span>
              <span className="text-[11px] text-[var(--text-muted)] font-normal">
                (Drag Entry, Stop, Target handles on chart)
              </span>
              <button
                type="button"
                onClick={() => setTool('navigate')}
                className="ml-2 rounded bg-sky-500/20 px-2 py-0.5 text-sky-300 hover:text-white"
              >
                Done adjusting
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-purple-400">
              <span>✏️ Drawing: {tool.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => {
                  setTool('navigate');
                  pending.current = null;
                }}
                className="ml-2 rounded bg-purple-500/20 px-2 py-0.5 text-purple-300 hover:text-white"
              >
                Done drawing
              </button>
            </span>
          )}
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {tool === 'navigate'
            ? 'Touch: 1 finger pans, 2 fingers pinch to zoom'
            : tool === 'plan'
            ? 'Touch: drag level handles up/down to adjust prices'
            : 'Touch: tap or drag to draw without chart moving'}
        </span>
      </div>

      {/* Drawing Toolbar */}
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Drawing tools">
        {(planLevels
          ? (['navigate', 'plan', 'level', 'trend', 'zone', 'text', 'edit'] as const)
          : (['navigate', 'level', 'trend', 'zone', 'text', 'edit'] as const)
        ).map((t) => (
          <button
            key={t}
            type="button"
            className={`button-secondary capitalize ${
              tool === t ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white' : ''
            }`}
            aria-pressed={tool === t}
            onClick={() => {
              setTool(t);
              pending.current = null;
            }}
          >
            {t === 'plan' ? 'Plan handles' : t}
          </button>
        ))}
        <button
          type="button"
          className="button-secondary"
          disabled={!undo.length}
          onClick={() => {
            setRedo((v) => [...v, drawings]);
            setDrawings(undo.at(-1)!);
            setUndo((v) => v.slice(0, -1));
            setDirty(true);
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={!redo.length}
          onClick={() => {
            setUndo((v) => [...v, drawings]);
            setDrawings(redo.at(-1)!);
            setRedo((v) => v.slice(0, -1));
            setDirty(true);
          }}
        >
          Redo
        </button>
      </div>

      {/* Text Annotation Input when Tool is Text */}
      {tool === 'text' && (
        <label className="block text-xs">
          Annotation text
          <input
            aria-label="Annotation text"
            className="field mt-1 block w-full max-w-sm"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      )}

      {/* Main Chart or Accessible Table View */}
      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-6">
          <p role="status" className="text-sm text-[var(--text-secondary)]">
            Loading provider candles…
          </p>
        </div>
      ) : data?.candles.length ? (
        table ? (
          <div className="max-h-96 overflow-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-xs">
              <caption className="sr-only">
                {symbol} OHLCV · {data.timezone}
              </caption>
              <thead className="sticky top-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                <tr>
                  {['Time', 'Open', 'High', 'Low', 'Close', 'Volume'].map((label) => (
                    <th key={label} scope="col" className="p-2 text-left font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                {data.candles.map((c) => (
                  <tr key={c.time} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="p-2">{c.time}</td>
                    <td className="p-2">{c.open.toFixed(2)}</td>
                    <td className="p-2">{c.high.toFixed(2)}</td>
                    <td className="p-2">{c.low.toFixed(2)}</td>
                    <td className="p-2 font-semibold">{c.close.toFixed(2)}</td>
                    <td className="p-2">{c.volume !== null ? c.volume.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className={`relative w-full min-w-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] ${
              isExpanded ? 'flex-1 min-h-[380px] h-[calc(100vh-220px)]' : 'h-[380px]'
            }`}
            aria-label={`${symbol} interactive candlestick chart`}
          >
            <div ref={host} className="h-full w-full" />
            <canvas
              ref={overlay}
              className="absolute inset-0 h-full w-full"
              style={{
                pointerEvents: tool === 'navigate' ? 'none' : 'auto',
                touchAction: tool === 'navigate' ? 'auto' : 'none',
                cursor: tool === 'plan' ? 'ns-resize' : 'default',
              }}
              onPointerDown={pointerDown}
              onPointerMove={(e) => {
                if (planDrag.current && onPlanLevelChangeRef.current && series.current) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const price = series.current.coordinateToPrice(y);
                  if (price && price > 0) {
                    onPlanLevelChangeRef.current(planDrag.current.level, Number(price.toFixed(2)));
                  }
                  return;
                }
                if (!drag.current) return;
                const p = point(e);
                if (p) {
                  setDrawings((v) =>
                    v.map((d) => (d.id === drag.current!.id ? { ...d, [drag.current!.anchor]: p } : d))
                  );
                }
              }}
              onPointerUp={() => {
                if (planDrag.current) {
                  planDrag.current = null;
                  return;
                }
                if (drag.current) {
                  setUndo((v) => [...v.slice(-29), drag.current!.previous]);
                  setRedo([]);
                  setDirty(true);
                  drag.current = null;
                }
              }}
              onPointerCancel={() => {
                if (planDrag.current) {
                  planDrag.current = null;
                  return;
                }
                if (drag.current) setDrawings(drag.current.previous);
                drag.current = null;
              }}
            />
          </div>
        )
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">{data?.note ?? error}</p>
        </div>
      )}

      {/* Indicator Warm-up Note & Attributions */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-2.5 text-[11px] text-[var(--text-secondary)] space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> SMA 20
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> EMA 20
          </span>
          <span className="text-[var(--text-muted)]">
            · Warm-up: Requires 20 completed candles before displaying initial line values.
          </span>
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">
          {data?.note ?? 'Missing sessions are not interpolated into invented candles.'}{' '}
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[var(--text-primary)]"
          >
            Charts by TradingView
          </a>{' '}
          (Apache 2.0).
        </p>
      </div>

      {/* Saved Chart Layouts & Persistence Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Saved chart layout"
          className="field max-w-full"
          value={layoutId}
          onChange={(e) => {
            if (dirty) {
              setError('Save or resolve unsaved changes before changing layouts.');
              return;
            }
            setLayoutId(e.target.value);
          }}
        >
          <option value={`chart-${symbol}-default`}>Default layout</option>
          {layouts
            .filter((r) => r.id !== `chart-${symbol}-default`)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {chartLayoutSchema.parse(r.data).name}
              </option>
            ))}
        </select>
        <input
          aria-label="Layout name"
          className="field max-w-full"
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
            setDirty(true);
          }}
        />
        <button type="button" className="button-secondary" onClick={() => void save()}>
          Save layout
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            if (dirty) {
              setError('Save current changes first.');
              return;
            }
            setLayoutId(crypto.randomUUID());
          }}
        >
          New layout
        </button>
      </div>

      {/* Selected Drawing Actions (Price edit, lock/unlock, delete, create price alert) */}
      {drawings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-2">
          <select
            className="field max-w-full"
            aria-label="Select drawing"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a drawing</option>
            {drawings.map((d) => (
              <option key={d.id} value={d.id}>
                {d.type} · {d.a.price.toFixed(2)} {d.locked ? '(locked)' : ''}
              </option>
            ))}
          </select>
          {chosen && (
            <>
              <label className="text-xs">
                Price
                <input
                  aria-label="Drawing price"
                  className="field w-28 block mt-0.5"
                  type="number"
                  min="0.000001"
                  step="any"
                  disabled={chosen.locked}
                  value={chosen.a.price}
                  onChange={(e) => {
                    const pr = Number(e.target.value);
                    if (pr > 0) {
                      commit(drawings.map((d) => (d.id === selected ? { ...d, a: { ...d.a, price: pr } } : d)));
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  commit(drawings.map((d) => (d.id === selected ? { ...d, locked: !d.locked } : d)))
                }
              >
                {chosen.locked ? 'Unlock' : 'Lock'}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={chosen.locked}
                onClick={() => commit(drawings.filter((d) => d.id !== selected))}
              >
                Delete drawing
              </button>
              {chosen.type === 'level' && onAlert && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => onAlert(chosen.a.price)}
                >
                  Create price alert
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Action to create trade plan */}
      {onAsk && <button className="button-secondary" onClick={() => onAsk({ symbol, interval, range, drawings: drawings.slice(0, 10) })}>Ask assistant about this chart</button>}
      {onPlan && (
        <button
          type="button"
          className="button-primary min-h-[44px]"
          onClick={() => {
            if (dirty) {
              setError('Save chart changes before opening a plan.');
              return;
            }
            const levelDrawings = drawings.filter((d) => d.type === 'level').map((d) => d.a.price);
            const latestClose = data?.candles.at(-1)?.close;
            const entry = planLevels?.entry ?? latestClose ?? (levelDrawings.length ? levelDrawings[0] : undefined);
            const sorted = [...levelDrawings].sort((a, b) => a - b);
            let stop = planLevels?.stop;
            let target = planLevels?.target;
            if (entry && !stop && sorted.length) {
              const lower = sorted.filter((p) => p < entry).pop();
              if (lower) stop = lower;
            }
            if (entry && !target && sorted.length) {
              const higher = sorted.filter((p) => p > entry)[0];
              if (higher) target = higher;
            }
            onPlan({
              entry,
              stop,
              target,
              direction: planLevels?.direction ?? (target && stop ? (target > entry! ? 'long' : 'short') : 'long'),
            });
          }}
        >
          Create a trade plan
        </button>
      )}

      {/* Storage and Error Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p role="status" className="text-[var(--text-secondary)]">
          {dirty ? 'Unsaved changes' : store.user ? `Account synced · @${store.user.username}` : 'Saved locally on this device'}
        </p>
        {error && (
          <p role="alert" className="text-amber-500 font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
