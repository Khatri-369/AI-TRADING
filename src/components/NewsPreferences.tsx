import { useState } from 'react';
import { newsPreferencesSchema } from '../../shared/research';
import { useResearchStore } from '../hooks/useResearchStore';

export default function NewsPreferences({ onNotifications }: { onNotifications: () => void }) {
  const store = useResearchStore();
  const record = store.records.find(r => r.kind === 'preferences');
  const parsed = newsPreferencesSchema.safeParse(record?.data);
  const [value, setValue] = useState(parsed.success ? parsed.data : newsPreferencesSchema.parse({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, quietStart: 22, quietEnd: 8 }));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="research-card space-y-3" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); void store.save(record?.id ?? 'news-preferences', 'preferences', value, record?.version ?? 0).then(() => setMessage(store.user ? 'News preferences saved to your account.' : 'Guest preferences saved. Sign in and import to activate.')).catch(error => setMessage(error.message)).finally(() => setBusy(false)); }}>
    <h2 className="font-semibold">News notifications</h2>
    <p className="text-sm text-[var(--text-secondary)]">Receive new headlines for your saved instruments. Matching uses the provider’s instrument tags; some relevant stories may not be tagged.</p>
    <label className="block text-xs">News coverage<select className="field block w-full" value={value.scope} onChange={e => setValue({ ...value, scope: e.target.value as typeof value.scope })}><option value="watchlist">My account watchlist</option><option value="all">All tracked market news</option></select></label>
    <label className="block text-xs">Minimum minutes between headlines<input className="field block w-full" type="number" min={5} max={1440} required value={value.frequencyMinutes} onChange={e => setValue({ ...value, frequencyMinutes: Number(e.target.value) })} /></label>
    <label className="block text-xs">News quiet-hours timezone<input className="field block w-full" value={value.timezone} onChange={e => setValue({ ...value, timezone: e.target.value })} /></label>
    <div className="grid grid-cols-2 gap-2">{(['quietStart', 'quietEnd'] as const).map(key => <label key={key} className="text-xs">{key === 'quietStart' ? 'News quiet start hour' : 'News quiet end hour'}<input className="field block w-full" type="number" min={0} max={23} required value={value[key]} onChange={e => setValue({ ...value, [key]: Number(e.target.value) })} /></label>)}</div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.paused} onChange={e => setValue({ ...value, paused: e.target.checked })} />Pause news notifications</label>
    <div className="flex flex-wrap gap-2"><button disabled={busy} className="button-primary">Save news preferences</button><button type="button" className="button-secondary" onClick={onNotifications}>Set up device notifications</button></div>
    <p className="text-xs">Sign in, save your preferences, then enable or renew alerts on this device. Guest device subscriptions receive general news. Equal quiet hours disable quiet time. News is checked every five minutes while the backend runs.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
