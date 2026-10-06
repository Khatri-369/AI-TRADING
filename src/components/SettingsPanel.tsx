import { ShieldCheck, X } from 'lucide-react';
import { getHealth, setApplicationToken } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { ErrorNotice, Loading } from './Feedback';
import StatusBadge from './StatusBadge';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const health = usePolling(getHealth, 60_000);
  return <section id="provider-settings" aria-labelledby="settings-heading" className="panel mb-6">
    <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="settings-heading" className="section-heading"><ShieldCheck className="h-5 w-5 text-indigo-400" />Provider connections</h2><p className="mt-2 text-sm text-slate-400">Credentials are configured in the server environment. Status describes configuration and the latest provider request.</p></div><button className="icon-button" onClick={onClose} aria-label="Close provider settings"><X className="h-4 w-4" /></button></div>
    {health.error && <ErrorNotice message={health.error} onRetry={health.refresh} />}
    {health.loading && !health.data && <Loading label="Checking provider configuration…" />}
    {health.data?.aiAccess === 'protected' && <label className="mb-5 block text-sm text-slate-300">Application access token<input className="field mt-2" type="password" autoComplete="off" onChange={event => setApplicationToken(event.target.value)} placeholder="Application token supplied by the server administrator" /><span className="mt-2 block text-xs text-slate-400">Held in memory only. This is an application token, never a provider API key.</span></label>}
    {health.data?.aiAccess === 'disabled' && <ErrorNotice message="AI is disabled in production until the server administrator configures AI_ACCESS_TOKEN." />}
    {health.data && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{health.data.providers.map(provider => <article key={provider.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-200">{provider.name}</h3><StatusBadge status={health.error ? 'stale' : provider.status} /></div><p className="mt-2 text-xs leading-relaxed text-slate-400">{provider.message}</p><p className="mt-2 text-xs text-slate-400">{provider.configured ? 'Server configuration available' : 'Server configuration required'}</p></article>)}</div>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">A configured provider may still require network access, quota, or exchange entitlements.</p><button className="button-secondary" disabled={health.loading} onClick={health.refresh}>Check status</button></div>
  </section>;
}
