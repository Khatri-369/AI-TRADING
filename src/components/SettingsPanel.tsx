import { useState } from 'react';
import { ShieldCheck, X, RefreshCw, KeyRound, Server, Activity, Sparkles, CheckCircle2 } from 'lucide-react';
import { getHealth, getQuota, getAdminDiagnostics, setApplicationToken, getApplicationToken } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { ErrorNotice, Loading } from './Feedback';
import StatusBadge from './StatusBadge';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const health = usePolling(getHealth, 60_000);
  const quota = usePolling(getQuota, 30_000);
  const [adminToken, setAdminToken] = useState(() => getApplicationToken());
  const [adminData, setAdminData] = useState<Record<string, unknown> | null>(null);
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken.trim()) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const data = await getAdminDiagnostics(adminToken.trim(), new AbortController().signal);
      setAdminData(data);
      setApplicationToken(adminToken.trim());
      quota.refresh();
    } catch (cause) {
      setAdminError(cause instanceof Error ? cause.message : 'Administrative unlock failed.');
      setAdminData(null);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <section
      id="provider-settings"
      aria-labelledby="settings-heading"
      className="panel mb-6 border-[var(--border-default)]"
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" />
            <h2 id="settings-heading" className="section-heading text-base">
              Provider connections & diagnostics
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Sanitized public telemetry. Credentials remain strictly server-side; status reflects active health and latest request outcomes.
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close provider settings">
          <X className="h-4 w-4" />
        </button>
      </div>

      {health.error && <ErrorNotice message={health.error} onRetry={health.refresh} />}

      {health.loading && !health.data && <Loading label="Polling provider connection diagnostic states…" />}

      {/* Public Session AI Quota Card */}
      <div className="mb-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
            <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
            Public Session AI Allowance
          </span>
          {quota.data?.isAdmin ? (
            <span className="inline-flex items-center gap-1 rounded bg-[var(--gain-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--gain-text)] border border-[var(--gain-border)]">
              <CheckCircle2 className="h-3 w-3" /> Admin Unlimited Access
            </span>
          ) : (
            <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
              {quota.data ? `${quota.data.remaining} of ${quota.data.limit} queries remaining` : '5 of 5 daily queries'}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          {quota.data?.isAdmin
            ? 'Administrator authorization active. Session is exempt from public daily query caps.'
            : 'Every anonymous visitor receives a complimentary daily allowance of 5 AI evaluations per rolling 24-hour window with automatic abuse prevention.'}
        </p>
      </div>

      {/* Operator Diagnostics & Administrative Unlock */}
      <div className="mb-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
        <form onSubmit={handleAdminUnlock} className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="admin-token-input" className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <KeyRound className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              Administrative Unlock & Protected Diagnostics
            </label>
            <span className="text-[10px] text-[var(--text-muted)]">Optional (Server Operators)</span>
          </div>
          <div className="flex gap-2">
            <input
              id="admin-token-input"
              className="field font-mono text-xs flex-1"
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Enter ADMIN_DIAGNOSTICS_TOKEN"
            />
            <button
              type="submit"
              disabled={adminLoading || !adminToken.trim()}
              className="button-secondary text-xs shrink-0"
            >
              {adminLoading ? 'Verifying…' : 'Unlock'}
            </button>
          </div>
        </form>

        {adminError && <div className="mt-2 text-xs text-[var(--loss-text)]">{adminError}</div>}

        {adminData && (
          <div className="mt-3 space-y-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-xs">
            <div className="font-semibold text-[var(--accent-text)] flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Protected Server Telemetry (Live)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-[var(--text-secondary)]">
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="block text-[10px] text-[var(--text-muted)]">Active SSE:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {String((adminData.system as { activeSSEClients?: number })?.activeSSEClients ?? 0)}
                </span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="block text-[10px] text-[var(--text-muted)]">Peak SSE:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {String((adminData.system as { peakSSEClients?: number })?.peakSSEClients ?? 0)}
                </span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="block text-[10px] text-[var(--text-muted)]">AI Today / Cap:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {String((adminData.aiSpending as { globalDailyCount?: number })?.globalDailyCount ?? 0)} /{' '}
                  {String((adminData.aiSpending as { dailyBudgetLimit?: number })?.dailyBudgetLimit ?? 100)}
                </span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="block text-[10px] text-[var(--text-muted)]">Memory (RSS):</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {String((adminData.system as { memory?: { rssMb?: number } })?.memory?.rssMb ?? '—')} MB
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Public Sanitized Provider Health Grid */}
      {health.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {health.data.providers.map((provider) => (
            <article
              key={provider.id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h3 className="font-semibold text-xs text-[var(--text-primary)]">{provider.name}</h3>
                <StatusBadge status={provider.status === 'connected' ? 'live' : 'unavailable'} />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  <span>{provider.status === 'connected' ? 'Connected' : 'Offline / Unconfigured'}</span>
                </span>
                <span className="font-mono uppercase">{provider.id}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Diagnostics Footer Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[11px] text-[var(--text-muted)]">
          Uptime: {health.data?.uptimeSeconds ?? 0}s · Platform Version: {health.data?.version ?? '1.0.0'}
        </p>
        <button className="button-secondary text-xs" disabled={health.loading} onClick={health.refresh}>
          <RefreshCw className={`h-3 w-3 ${health.loading ? 'animate-spin' : ''}`} />
          <span>Refresh Health</span>
        </button>
      </div>
    </section>
  );
}
