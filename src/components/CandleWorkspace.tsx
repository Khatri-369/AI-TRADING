import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { getCandles } from '../services/api';
import { chartLayoutSchema, movingAverage, type Drawing } from '../../shared/research';
import { useResearchStore } from '../hooks/useResearchStore';
import type { HistoryRange, ThemeType } from '../types/market';

export default function CandleWorkspace({ symbol, theme, onPlan, onAlert }: { symbol: string; theme: ThemeType; onPlan?: () => void; onAlert?: (level: number) => void }) {
  const store = useResearchStore();
  const [interval, setInterval] = useState<'5m' | '30m' | '1d'>('1d');
  const [range, setRange] = useState<HistoryRange>('1M');
  const [data, setData] = useState<Awaited<ReturnType<typeof getCandles>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<'navigate' | 'edit' | Drawing['type']>('navigate');
  const [text, setText] = useState('My note');
  const [name, setName] = useState('Default');
  const [layoutId, setLayoutId] = useState(`chart-${symbol}-default`);
  const [version, setVersion] = useState(0);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selected, setSelected] = useState('');
  const [undo, setUndo] = useState<Drawing[][]>([]);
  const [redo, setRedo] = useState<Drawing[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [table, setTable] = useState(false);
  const root = useRef<HTMLDivElement>(null); const host = useRef<HTMLDivElement>(null); const overlay = useRef<HTMLCanvasElement>(null);
  const chart = useRef<IChartApi | null>(null); const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const drawingRef = useRef(drawings); drawingRef.current = drawings;
  const pending = useRef<Drawing['a'] | null>(null);
  const drag = useRef<{ id: string; anchor: 'a' | 'b'; previous: Drawing[] } | null>(null);
  const loaded = useRef('');
  useEffect(() => {
    const identity = `${store.user?.id ?? 'guest'}:${layoutId}`;
    const record = store.records.find(r => r.id === layoutId && r.kind === 'chart');
    if (loaded.current === identity) return;
    loaded.current = identity;
    const parsed = chartLayoutSchema.safeParse(record?.data);
    setDrawings(parsed.success ? parsed.data.drawings : []); setVersion(record?.version ?? 0); setName(parsed.success ? parsed.data.name : 'Default'); setDirty(false); setUndo([]); setRedo([]);
  }, [store.records, store.user?.id, layoutId]);
  const commit = (next: Drawing[]) => { setUndo(previous => [...previous.slice(-29), drawingRef.current]); setRedo([]); setDrawings(next); setDirty(true); };
  const layouts = store.records.filter(r => r.kind === 'chart' && chartLayoutSchema.safeParse(r.data).success && chartLayoutSchema.parse(r.data).symbol === symbol);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    void getCandles(symbol, interval, range, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [symbol, interval, range]);
  async function save() {
    try { await store.save(layoutId, 'chart', { symbol, name, interval, drawings }, version); setVersion(v => v + 1); setDirty(false); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save layout.'); }
  }
  useEffect(() => { if (!dirty) return; const timer = setTimeout(() => { void save(); }, 1200); return () => clearTimeout(timer); }, [drawings, name, dirty]); // Deliberately retain the edit's original version for conflict detection.
  useEffect(() => {
    if (!host.current || !data?.candles.length || table) return;
    const dark = theme === 'dark';
    const api = createChart(host.current, { autoSize: true, height: 400, layout: { background: { type: ColorType.Solid, color: dark ? '#0f172a' : '#ffffff' }, textColor: dark ? '#cbd5e1' : '#334155', attributionLogo: true }, grid: { vertLines: { color: dark ? '#1e293b' : '#f1f5f9' }, horzLines: { color: dark ? '#1e293b' : '#f1f5f9' } }, timeScale: { timeVisible: interval !== '1d' }, rightPriceScale: { scaleMargins: { top: .08, bottom: .25 } } });
    const candles = api.addSeries(CandlestickSeries, { upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444' });
    candles.setData(data.candles.map(c => ({ ...c, time: (Date.parse(c.time) / 1000) as UTCTimestamp })));
    const volume = api.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' } });
    volume.priceScale().applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    volume.setData(data.candles.filter(c => c.volume !== null).map(c => ({ time: (Date.parse(c.time) / 1000) as UTCTimestamp, value: c.volume!, color: c.close >= c.open ? '#10b98155' : '#ef444455' })));
    for (const [exponential, color] of [[false, '#3b82f6'], [true, '#f59e0b']] as const) {
      const line = api.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      line.setData(movingAverage(data.candles, 20, exponential).map(p => ({ time: Date.parse(p.time) / 1000 as UTCTimestamp, value: p.value })));
    }
    api.timeScale().fitContent(); chart.current = api; series.current = candles;
    let frame = 0;
    function paint() {
      const canvas = overlay.current; if (!canvas || !host.current) return;
      const width = host.current.clientWidth; const height = host.current.clientHeight; const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
      const ctx = canvas.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
      for (const d of drawingRef.current) {
        const ax = api.timeScale().timeToCoordinate(d.a.time as UTCTimestamp); const ay = candles.priceToCoordinate(d.a.price);
        const bx = d.b ? api.timeScale().timeToCoordinate(d.b.time as UTCTimestamp) : ax; const by = d.b ? candles.priceToCoordinate(d.b.price) : ay;
        if (ax === null || ay === null || bx === null || by === null) continue;
        ctx.strokeStyle = '#8b5cf6'; ctx.fillStyle = '#8b5cf622'; ctx.lineWidth = 2; ctx.beginPath();
        if (d.type === 'level') { ctx.moveTo(0, ay); ctx.lineTo(width - 65, ay); }
        if (d.type === 'trend') { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
        if (d.type === 'zone') { ctx.rect(ax, ay, bx - ax, by - ay); ctx.fill(); }
        ctx.stroke(); ctx.fillStyle = dark ? '#c4b5fd' : '#6d28d9'; ctx.font = '12px system-ui';
        if (d.type === 'text') ctx.fillText(d.text, ax, ay);
        if (d.type === 'level') ctx.fillText(d.a.price.toFixed(2), 8, ay - 6);
        if (!d.locked) { ctx.fillRect(ax - 4, ay - 4, 8, 8); if (d.b) ctx.fillRect(bx - 4, by - 4, 8, 8); }
      }
      frame = requestAnimationFrame(paint);
    }
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); api.remove(); chart.current = null; series.current = null; };
  }, [data, theme, table]);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    const time = chart.current?.timeScale().coordinateToTime(x); const price = series.current?.coordinateToPrice(y);
    return typeof time === 'number' && price && price > 0 ? { time, price } : null;
  }
  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(event); if (!p) return;
    if (tool === 'edit') {
      const rect = event.currentTarget.getBoundingClientRect();
      for (const d of [...drawings].reverse()) for (const anchor of ['a', 'b'] as const) {
        const a = d[anchor]; if (!a || d.locked) continue;
        const x = chart.current?.timeScale().timeToCoordinate(a.time as UTCTimestamp); const y = series.current?.priceToCoordinate(a.price);
        if (x != null && y != null && Math.hypot(event.clientX - rect.left - x, event.clientY - rect.top - y) < 24) { drag.current = { id: d.id, anchor, previous: drawings }; setSelected(d.id); event.currentTarget.setPointerCapture(event.pointerId); return; }
      }
      return;
    }
    if (tool === 'navigate' || drawings.length >= 50) return;
    if ((tool === 'trend' || tool === 'zone') && !pending.current) { pending.current = p; setError('Tap the second point to finish the drawing.'); return; }
    const d: Drawing = { id: crypto.randomUUID(), type: tool, a: pending.current ?? p, ...(pending.current ? { b: p } : {}), text, locked: false };
    pending.current = null; commit([...drawings, d]); setSelected(d.id); setError('');
  }
  async function exportImage() {
    const screenshot = chart.current?.takeScreenshot(); if (!screenshot || !overlay.current) return;
    const canvas = document.createElement('canvas'); canvas.width = screenshot.width; canvas.height = screenshot.height + 100;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = theme === 'dark' ? '#0f172a' : '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(screenshot, 0, 0); ctx.drawImage(overlay.current, 0, 0, screenshot.width, screenshot.height); ctx.fillStyle = theme === 'dark' ? '#fff' : '#111'; ctx.font = '14px system-ui'; ctx.fillText(`${symbol} · ${interval} · ${data?.currency} · ${data?.provider} · ${data?.status}`, 12, screenshot.height + 25); ctx.fillText(`Export ${new Date().toISOString()} · Charts by TradingView`, 12, screenshot.height + 50);
    const link = document.createElement('a'); link.download = `${symbol}-${interval}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  }
  const chosen = drawings.find(d => d.id === selected);
  return <div ref={root} className="space-y-3 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-default)]">
    <h3 className="font-semibold">Chart workspace</h3>
    <div className="flex flex-wrap gap-2"><label className="text-xs">Candle interval<select aria-label="Candle interval" className="field block" value={interval} onChange={e => { const next = e.target.value as typeof interval; setInterval(next); if (next !== '1d' && ['3M', '6M', '1Y'].includes(range)) setRange('1M'); }}><option value="5m">5 minutes</option><option value="30m">30 minutes</option><option value="1d">Daily</option></select></label><label className="text-xs">Range<select aria-label="Candle range" className="field block" value={range} onChange={e => setRange(e.target.value as HistoryRange)}>{(interval === '1d' ? ['1M', '3M', '6M', '1Y'] : ['1D', '5D', '1M']).map(r => <option key={r}>{r}</option>)}</select></label><button className="button-secondary" onClick={() => chart.current?.timeScale().fitContent()}>Reset view</button><button className="button-secondary" onClick={() => { void root.current?.requestFullscreen().catch(() => setError('Full-screen is unavailable in this browser.')); }}>Full screen</button><button className="button-secondary" onClick={() => setTable(v => !v)}>{table ? 'Show candles' : 'Candle table'}</button><button className="button-secondary" disabled={!data?.candles.length || table} onClick={() => void exportImage()}>Export PNG</button></div>
    <div className="flex flex-wrap gap-1" role="group" aria-label="Drawing tools">{(['navigate', 'level', 'trend', 'zone', 'text', 'edit'] as const).map(t => <button key={t} className="button-secondary capitalize" aria-pressed={tool === t} onClick={() => { setTool(t); pending.current = null; }}>{t}</button>)}<button className="button-secondary" disabled={!undo.length} onClick={() => { setRedo(v => [...v, drawings]); setDrawings(undo.at(-1)!); setUndo(v => v.slice(0, -1)); setDirty(true); }}>Undo</button><button className="button-secondary" disabled={!redo.length} onClick={() => { setUndo(v => [...v, drawings]); setDrawings(redo.at(-1)!); setRedo(v => v.slice(0, -1)); setDirty(true); }}>Redo</button></div>
    {tool === 'text' && <input aria-label="Annotation text" className="field" value={text} maxLength={120} onChange={e => setText(e.target.value)} />}
    {loading ? <p role="status">Loading provider candles…</p> : data?.candles.length ? table ? <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><caption>{symbol} OHLCV · {data.timezone}</caption><thead><tr>{['Time', 'Open', 'High', 'Low', 'Close', 'Volume'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.candles.map(c => <tr key={c.time}>{[c.time, c.open, c.high, c.low, c.close, c.volume ?? '—'].map((v, i) => <td key={i} className="p-2">{v}</td>)}</tr>)}</tbody></table></div> : <div className="relative h-[400px]" aria-label={`${symbol} interactive candlestick chart`}><div ref={host} className="h-full w-full" /><canvas ref={overlay} className="absolute inset-0 h-full w-full" style={{ pointerEvents: tool === 'navigate' ? 'none' : 'auto', touchAction: tool === 'navigate' ? 'auto' : 'none' }} onPointerDown={pointerDown} onPointerMove={e => { if (!drag.current) return; const p = point(e); if (p) setDrawings(v => v.map(d => d.id === drag.current!.id ? { ...d, [drag.current!.anchor]: p } : d)); }} onPointerUp={() => { if (drag.current) { setUndo(v => [...v.slice(-29), drag.current!.previous]); setRedo([]); setDirty(true); drag.current = null; } }} onPointerCancel={() => { if (drag.current) setDrawings(drag.current.previous); drag.current = null; }} /></div> : <p className="text-sm">{data?.note ?? error}</p>}
    <p className="text-xs text-[var(--text-muted)]">{data?.provider} · {data?.status} · {data?.timezone} · {data?.note} SMA 20 (blue), EMA 20 (amber) require 20 candles. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline">Charts by TradingView</a>.</p>
    <div className="flex flex-wrap gap-2"><select aria-label="Saved chart layout" className="field max-w-full" value={layoutId} onChange={e => { if (dirty) { setError('Save or resolve unsaved changes before changing layouts.'); return; } setLayoutId(e.target.value); }}><option value={`chart-${symbol}-default`}>Default layout</option>{layouts.filter(r => r.id !== `chart-${symbol}-default`).map(r => <option key={r.id} value={r.id}>{chartLayoutSchema.parse(r.data).name}</option>)}</select><input aria-label="Layout name" className="field max-w-full" maxLength={60} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} /><button className="button-secondary" onClick={() => void save()}>Save layout</button><button className="button-secondary" onClick={() => { if (dirty) { setError('Save current changes first.'); return; } setLayoutId(crypto.randomUUID()); }}>New layout</button></div>
    {drawings.length > 0 && <div className="flex flex-wrap gap-2"><select className="field max-w-full" aria-label="Select drawing" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a drawing</option>{drawings.map(d => <option key={d.id} value={d.id}>{d.type} · {d.a.price.toFixed(2)} {d.locked ? '(locked)' : ''}</option>)}</select>{chosen && <><label className="text-xs">Price<input aria-label="Drawing price" className="field w-28 block" type="number" min="0.000001" step="any" disabled={chosen.locked} value={chosen.a.price} onChange={e => { const price = Number(e.target.value); if (price > 0) commit(drawings.map(d => d.id === selected ? { ...d, a: { ...d.a, price } } : d)); }} /></label><button className="button-secondary" onClick={() => commit(drawings.map(d => d.id === selected ? { ...d, locked: !d.locked } : d))}>{chosen.locked ? 'Unlock' : 'Lock'}</button><button className="button-secondary" disabled={chosen.locked} onClick={() => commit(drawings.filter(d => d.id !== selected))}>Delete drawing</button>{chosen.type === 'level' && onAlert && <button className="button-secondary" onClick={() => onAlert(chosen.a.price)}>Create price alert</button>}</>}</div>}
    {onPlan && <button className="button-primary" onClick={onPlan}>Create a trade plan</button>}
    <p role="status" className="text-xs">{dirty ? 'Unsaved changes' : store.status}</p>{error && <p role="alert" className="text-sm">{error}</p>}
  </div>;
}
