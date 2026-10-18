import { useState } from 'react';
import {
  ShieldCheck,
  X,
  RefreshCw,
  KeyRound,
  Server,
  Activity,
  Sparkles,
  CheckCircle2,
  Bell,
  BellRing,
  BellOff,
  AlertTriangle,
  Play,
  Moon,
  Filter,
  Smartphone,
} from 'lucide-react';
import type { NewsArticle, Quote } from '../types/market';
import { getHealth, getQuota, getAdminDiagnostics, setApplicationToken, getApplicationToken } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { useWatchlist } from '../hooks/useWatchlist';
import { useNewsAlertSettings } from '../hooks/useNewsAlertSettings';
import { ErrorNotice, Loading } from './Feedback';
import StatusBadge from './StatusBadge';

interface SettingsPanelProps {
  onClose: () => void;
  quotes?: Quote[];
  newsArticles?: NewsArticle[];
}

export default function SettingsPanel({ onClose, quotes = [] }: SettingsPanelProps) {
  const health = usePolling(getHealth, 60_000);
  const quota = usePolling(getQuota, 30_000);
  const { symbols } = useWatchlist();
  const {
    settings,
    permission,
    requesting,
    feedbackMessage,
    toggleEnabled,
    toggleDeviceNotifications,
    setScope,
    setQuiet,
    sendTestAlert,
  } = useNewsAlertSettings();

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
      {/* Settings Panel Header */}
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" />
            <h2 id="settings-heading" className="section-heading text-base">
              Provider connections & diagnostics
            </h2>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Configure live news notifications, AI usage allowances, protected operator telemetry, and real-time market data providers.
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close provider settings">
          <X className="h-4 w-4" />
        </button>
      </div>

      {health.error && <ErrorNotice message={health.error} onRetry={health.refresh} />}

      {health.loading && !health.data && <Loading label="Polling provider connection diagnostic states…" />}

      {/* Real-Time News & Market Notifications Card */}
      <div className="mb-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] p-4 shadow-sm transition">
        {/* Card Header & Master On/Off Switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                settings.enabled
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
              }`}
            >
              {settings.enabled ? (
                <BellRing className="h-4 w-4 animate-pulse" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  News & Market Notifications
                </h3>
                {settings.enabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Notifications Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] border border-[var(--border-subtle)]">
                    Notifications Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Receive real-time breaking market news alerts with positive/negative stock impact.
              </p>
            </div>
          </div>

          {/* Master ON/OFF Switch Controls */}
          <div className="flex items-center gap-2.5">
            {/* Interactive Toggle Switch */}
            <button
              type="button"
              role="switch"
              id="news-notification-toggle"
              aria-checked={settings.enabled}
              aria-label={settings.enabled ? 'Turn news notifications off' : 'Turn news notifications on'}
              onClick={toggleEnabled}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] ${
                settings.enabled ? 'bg-emerald-500' : 'bg-[var(--border-default)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Direct ON/OFF Button */}
            <button
              type="button"
              id="news-notification-button"
              onClick={toggleEnabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer min-h-[32px] ${
                settings.enabled
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-[var(--accent-primary)] text-white hover:opacity-90'
              }`}
            >
              {settings.enabled ? (
                <>
                  <BellOff className="h-3.5 w-3.5" />
                  <span>Turn Notifications OFF</span>
                </>
              ) : (
                <>
                  <BellRing className="h-3.5 w-3.5" />
                  <span>Turn Notifications ON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Feedback Banner */}
        {feedbackMessage && (
          <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2.5 text-xs text-[var(--text-primary)] flex items-center gap-2 animate-in fade-in duration-200">
            <Sparkles className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Granular Notification Controls */}
        <div className={`mt-3.5 space-y-3 transition-opacity ${!settings.enabled ? 'opacity-40 pointer-events-none select-none' : ''}`}>
          {/* Push & System Notifications Section */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    System & Browser Push Notifications
                  </span>
                  {permission === 'granted' && settings.device ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Allowed
                    </span>
                  ) : permission === 'denied' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> Blocked in browser
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Browser permission required
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Checks for new headlines every minute while this app is running. Browsers may suspend background tabs; alerts catch up when you return. Closed-app alerts require background push setup.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={requesting}
              onClick={toggleDeviceNotifications}
              className={`button-secondary text-xs shrink-0 min-h-[32px] flex items-center gap-1.5 cursor-pointer ${
                settings.device ? 'border-emerald-500/40 text-emerald-400' : ''
              }`}
            >
              {requesting ? (
                <span>Requesting permission…</span>
              ) : settings.device ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Push Alerts Enabled (Turn Off)</span>
                </>
              ) : (
                <>
                  <Bell className="h-3.5 w-3.5" />
                  <span>Enable System Push Notifications</span>
                </>
              )}
            </button>
          </div>

          {/* Scope and Quiet Hours Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Scope Selection */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Filter className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                Alert Scope
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border text-center transition cursor-pointer ${
                    settings.scope === 'all'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  All Market News
                </button>
                <button
                  type="button"
                  onClick={() => setScope('watchlist')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border text-center transition cursor-pointer ${
                    settings.scope === 'watchlist'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Watchlist Only {symbols.length > 0 ? `(${symbols.length})` : '(0)'}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                {settings.scope === 'all'
                  ? 'All breaking stories from Indian & international financial wires.'
                  : `Alerts exclusively for symbols in your watchlist (${symbols.join(', ') || 'none yet'}).`}
              </p>
            </div>

            {/* Quiet Hours & Test Notification */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 flex flex-col justify-between">
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                    <Moon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Quiet Hours (10 PM – 8 AM)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.quiet}
                    onChange={(e) => setQuiet(e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--accent-primary)] cursor-pointer"
                  />
                </label>
                <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                  Silences audible and popup alerts overnight during non-market hours.
                </p>
              </div>

              {/* Instant Test Alert Trigger */}
              <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">Test how alerts appear:</span>
                <button
                  type="button"
                  onClick={() => sendTestAlert(quotes)}
                  className="button-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Trigger a test news notification banner and system notification"
                >
                  <Play className="h-3 w-3 text-emerald-400" />
                  <span>Send Test Notification</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
