import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { z } from 'zod';
import type { NewsResponse } from '../../shared/types';

const settingsSchema = z.object({ enabled: z.boolean(), scope: z.enum(['all', 'watchlist']), device: z.boolean(), quiet: z.boolean() });
const defaults = { enabled: false, scope: 'watchlist' as const, device: false, quiet: false };
type Settings = z.infer<typeof settingsSchema>;
type Notice = { id: string; headline: string; time: string; read: boolean };
const noticesSchema = z.array(z.object({ id: z.string().max(500), headline: z.string().max(1000), time: z.string().refine(value => Number.isFinite(Date.parse(value))), read: z.boolean() })).max(20);

export default function NewsAlerts({ news, symbols, storageKey, ready, onNews, onBackground }: {
  news: NewsResponse | null; symbols: string[]; storageKey: string; ready: boolean; onNews: () => void; onBackground: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => {
    try { return settingsSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? 'null')); } catch { return defaults; }
  });
  const [notices, setNotices] = useState<Notice[]>(() => {
    try { return noticesSchema.parse(JSON.parse(localStorage.getItem(`${storageKey}.inbox`) ?? '[]')); } catch { return []; }
  });
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const baseline = useRef<Set<string> | null>(null);
  const latestTime = useRef(0);
  const lastDevice = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const unread = notices.filter(n => !n.read).length;
  const symbolKey = symbols.join(',');

  function saveSettings(next: Settings) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSettings(next); setMessage(''); }
    catch { setMessage('Could not save alert preferences. Browser storage may be full or blocked.'); }
  }
  function saveNotices(next: Notice[]) {
    try { localStorage.setItem(`${storageKey}.inbox`, JSON.stringify(next)); setNotices(next); }
    catch { setMessage('The alert inbox could not be saved in this browser.'); }
  }
  // Changes of audience or opt-in establish a fresh baseline, never a backlog flood.
  useEffect(() => { baseline.current = null; latestTime.current = 0; }, [settings.enabled, settings.scope, symbolKey, ready]);
  useEffect(() => {
    if (!ready || !settings.enabled || !news || news.error || ['stale', 'unavailable'].includes(news.status)) return;
    const items = news.articles.filter(a => Number.isFinite(Date.parse(a.publishedAt)) && Date.parse(a.publishedAt) <= Date.now() + 300000);
    const newest = Math.max(0, ...items.map(a => Date.parse(a.publishedAt)).filter(Number.isFinite));
    if (!baseline.current) { if (!items.length) return; baseline.current = new Set(items.map(a => a.id)); latestTime.current = newest; return; }
    const since = latestTime.current;
    const fresh = items.filter(a => !baseline.current!.has(a.id) && Date.parse(a.publishedAt) >= since && Date.parse(a.publishedAt) <= Date.now() + 300000);
    baseline.current = new Set([...baseline.current, ...items.map(a => a.id)].slice(-500));
    latestTime.current = Math.max(since, newest);
    const hour = new Date().getHours();
    if (settings.quiet && (hour >= 22 || hour < 8)) return;
    const relevant = fresh.filter(a => settings.scope === 'all' || a.relatedAssets.some(s => symbols.includes(s))).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    if (!relevant.length) return;
    let stored: Notice[] = [];
    try { stored = noticesSchema.parse(JSON.parse(localStorage.getItem(`${storageKey}.inbox`) ?? '[]')); } catch { /* Corrupt storage is treated as empty. */ }
    const unique = relevant.filter(a => !stored.some(n => n.id === a.id));
    if (!unique.length) return;
    const next = [...unique.map(a => ({ id: a.id, headline: a.headline.slice(0, 1000), time: a.publishedAt, read: false })), ...stored].slice(0, 20);
    try { localStorage.setItem(`${storageKey}.inbox`, JSON.stringify(next)); setNotices(next); }
    catch { setMessage('The new headline arrived, but the alert inbox could not be saved.'); }
    setToast(`${unique.length} new ${unique.length === 1 ? 'headline' : 'headlines'}${settings.scope === 'watchlist' ? ' for your watchlist' : ''}`);
    if (settings.device && 'serviceWorker' in navigator && typeof Notification !== 'undefined' && Notification.permission === 'granted' && Date.now() - lastDevice.current > 60000) {
      lastDevice.current = Date.now();
      void navigator.serviceWorker.getRegistration().then(async registration => {
        if (!registration?.active) throw new Error();
        await registration.showNotification('Tradexa · New market news', { body: unique.length === 1 ? unique[0].headline : `${unique.length} new headlines. Open News to catch up.`, tag: `tradexa-news-${unique[0].id}`, icon: '/icons/tradexa-192.png', data: { url: '/news' } });
      }).catch(() => setMessage('Device alert could not be shown. The headline is available in your inbox.'));
    }
  }, [news, ready, settings, symbolKey, storageKey]); // Symbols are represented by symbolKey to avoid resetting on unrelated renders.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 8000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  async function enableDevice() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setMessage('Device alerts are unsupported here. In-app alerts still work.'); return; }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setMessage('Device notifications were not allowed. In-app alerts remain available.'); return; }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) { setMessage('Reload after the app has installed its service worker, then try again.'); return; }
      saveSettings({ ...settings, device: true, enabled: true });
    } catch { setMessage('Could not enable device notifications. Try your browser’s site settings.'); }
    finally { setBusy(false); }
  }
  return <div ref={panel} className="relative">
    <button ref={trigger} className="icon-button relative !border-transparent min-h-11 min-w-11" aria-label={`News notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen(!open); setToast(''); }}><Bell size={20} />{unread > 0 && <span className="absolute top-0 right-0 min-w-4 rounded-full bg-[var(--accent-primary)] px-1 text-[10px] text-white">{unread}</span>}</button>
    {open && <section aria-label="News notification inbox" className="fixed top-16 right-4 z-50 w-[min(380px,calc(100vw-32px))] max-h-[calc(100dvh-160px)] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold">News notifications</h2><button aria-label="Close news notifications" className="icon-button min-h-11 min-w-11" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <p className="text-xs leading-5 text-[var(--text-secondary)]">Checks for new headlines every five minutes while this app is visible. No alerts for the initial feed.</p>
      <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={settings.enabled} disabled={!ready} onChange={e => saveSettings({ ...settings, enabled: e.target.checked })} />Notify me about new headlines</label>
      <label className="block text-xs">Alert coverage<select className="field mt-1 min-h-11" disabled={!ready} value={settings.scope} onChange={e => saveSettings({ ...settings, scope: e.target.value as Settings['scope'] })}><option value="watchlist">My watchlist</option><option value="all">All market news</option></select></label>
      {settings.scope === 'watchlist' && !symbols.length && <p className="text-xs text-[var(--text-secondary)]">Save stocks first, or select All market news.</p>}
      <label className="flex items-center gap-2 text-xs min-h-11"><input type="checkbox" checked={settings.quiet} disabled={!ready} onChange={e => saveSettings({ ...settings, quiet: e.target.checked })} />Quiet hours: 10 pm–8 am on this device</label>
      <div className="flex flex-wrap gap-2"><button className="button-secondary min-h-11" disabled={busy || !ready} onClick={() => settings.device ? saveSettings({ ...settings, device: false }) : void enableDevice()}>{settings.device ? 'Turn off device alerts' : 'Also show device alerts'}</button><button className="button-secondary min-h-11" onClick={() => { setOpen(false); onBackground(); }}>Closed-app push setup</button></div>
      <p className="text-xs text-[var(--text-secondary)]">Device alerts also need this app running. Closed-app push is a separate server feature.</p>
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3"><h3 className="text-sm font-medium">Latest alerts</h3><button className="min-h-11 text-xs text-[var(--accent-text)]" disabled={!notices.length} onClick={() => saveNotices(notices.map(n => ({ ...n, read: true })))}>Mark all read</button></div>
      {!notices.length ? <p className="text-sm text-[var(--text-secondary)]">New matching headlines will appear here after you enable alerts.</p> : <div className="divide-y divide-[var(--border-subtle)]">{notices.map(n => <button key={n.id} className="block w-full py-3 text-left" onClick={() => { saveNotices(notices.map(item => item.id === n.id ? { ...item, read: true } : item)); setOpen(false); onNews(); }}><span className={`block text-sm ${n.read ? 'text-[var(--text-secondary)]' : 'font-semibold'}`}>{n.headline}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{new Date(n.time).toLocaleString()} · {n.read ? 'Read' : 'Unread'}</span></button>)}</div>}
    </section>}
    {toast && !open && <div role="status" className="fixed top-20 right-4 z-50 flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-lg max-w-[calc(100vw-32px)]"><button className="text-sm text-left min-h-11" onClick={() => { setOpen(true); setToast(''); }}>{toast} · View</button><button className="icon-button min-h-11 min-w-11" aria-label="Dismiss headline alert" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
