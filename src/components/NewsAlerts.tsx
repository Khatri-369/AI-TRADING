import { useEffect, useRef, useState } from 'react';
import { Bell, X, Check, ShieldAlert } from 'lucide-react';
import { z } from 'zod';
import type { NewsArticle } from '../types/market';
import { useWatchlist } from '../hooks/useWatchlist';

const STORAGE_INBOX = 'markets.alerts.inbox.v1';
const STORAGE_SETTINGS = 'markets.alerts.settings.v1';

const noticeSchema = z.object({
  id: z.string(),
  headline: z.string(),
  time: z.string(),
  read: z.boolean(),
  source: z.string().optional(),
});
const noticesSchema = z.array(noticeSchema);

type Notice = z.infer<typeof noticeSchema>;

interface AlertSettings {
  enabled: boolean;
  scope: 'watchlist' | 'all';
  quiet: boolean;
  device: boolean;
}

const defaultSettings: AlertSettings = {
  enabled: false,
  scope: 'watchlist',
  quiet: true,
  device: false,
};

interface Props {
  newsArticles: NewsArticle[];
  onOpenNews: () => void;
  onOpenBackgroundSetup?: () => void;
}

export default function NewsAlerts({
  newsArticles,
  onOpenNews,
  onOpenBackgroundSetup,
}: Props) {
  const { symbols } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Settings
  const [settings, setSettings] = useState<AlertSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS);
      if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
    } catch {
      // Ignore
    }
    return defaultSettings;
  });

  // Persistent inbox
  const [notices, setNotices] = useState<Notice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_INBOX);
      if (saved) {
        const parsed = noticesSchema.safeParse(JSON.parse(saved));
        if (parsed.success) return parsed.data;
      }
    } catch {
      // Ignore
    }
    return [];
  });

  const unreadCount = notices.filter((n) => !n.read).length;

  const baselineRef = useRef<Set<string> | null>(null);
  const lastDeviceNotifyTime = useRef<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const saveSettings = (next: AlertSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(next));
    } catch {
      setMessage('Settings could not be saved to browser storage.');
    }
  };

  const saveNotices = (next: Notice[]) => {
    const bounded = next.slice(0, 20);
    setNotices(bounded);
    try {
      localStorage.setItem(STORAGE_INBOX, JSON.stringify(bounded));
    } catch {
      setMessage('Inbox could not be saved to browser storage.');
    }
  };

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Baseline establishment and feed monitoring
  useEffect(() => {
    if (!newsArticles.length) return;

    // Establish baseline on first load so we never spam user with existing feed
    if (baselineRef.current === null) {
      baselineRef.current = new Set(newsArticles.map((a) => a.id));
      return;
    }

    if (!settings.enabled) return;

    const now = Date.now();
    const currentHour = new Date().getHours();

    // Respect quiet hours (10 PM to 8 AM local time)
    if (settings.quiet && (currentHour >= 22 || currentHour < 8)) {
      // Silently update baseline so we don't dump everything when quiet hours end
      baselineRef.current = new Set([...baselineRef.current, ...newsArticles.map((a) => a.id)].slice(-500));
      return;
    }

    // Filter truly new articles
    const freshArticles = newsArticles.filter((article) => {
      if (baselineRef.current?.has(article.id)) return false;
      const pubTime = Date.parse(article.publishedAt);
      if (Number.isNaN(pubTime)) return false;
      // Ignore stale feeds (> 3 hours old) or future timestamps (> 5 mins into future)
      if (pubTime < now - 3 * 3600 * 1000 || pubTime > now + 300 * 1000) return false;
      return true;
    });

    // Update baseline
    baselineRef.current = new Set([...baselineRef.current, ...newsArticles.map((a) => a.id)].slice(-500));

    if (!freshArticles.length) return;

    // Scope check: watchlist only vs all market
    const matching = freshArticles.filter((a) => {
      if (settings.scope === 'all') return true;
      if (!symbols.length) return false;
      return a.relatedAssets?.some((sym) => symbols.includes(sym));
    });

    if (!matching.length) return;

    // Filter duplicates already in inbox
    const newForInbox = matching.filter((a) => !notices.some((n) => n.id === a.id));
    if (!newForInbox.length) return;

    const newNotices: Notice[] = newForInbox.map((a) => ({
      id: a.id,
      headline: a.headline.slice(0, 300),
      time: a.publishedAt,
      read: false,
      source: a.source,
    }));

    const updated = [...newNotices, ...notices].slice(0, 20);
    saveNotices(updated);

    // Toast alert
    const count = newForInbox.length;
    setToast(
      `${count} new ${count === 1 ? 'headline' : 'headlines'}${
        settings.scope === 'watchlist' ? ' for your watchlist' : ''
      }`
    );

    // Device notification if opted-in and tab is in foreground
    if (
      settings.device &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      now - lastDeviceNotifyTime.current > 45000
    ) {
      lastDeviceNotifyTime.current = now;
      try {
        new Notification('Tradexa Market News', {
          body: newForInbox[0].headline,
          icon: '/favicon.ico',
          tag: `tradexa-news-${newForInbox[0].id}`,
        });
      } catch {
        // Notification constructor may fail in some environments
      }
    }
  }, [newsArticles, settings, symbols, notices]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // Request browser notification permission ONLY on explicit user click
  const requestDeviceAlerts = async () => {
    if (typeof Notification === 'undefined') {
      setMessage('Browser notifications are not supported in this browser. In-app alerts remain active.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        saveSettings({ ...settings, enabled: true, device: true });
        setMessage('Device alerts enabled for this browser.');
      } else {
        saveSettings({ ...settings, device: false });
        setMessage('Device notifications were not granted. In-app bell inbox remains active.');
      }
    } catch {
      setMessage('Could not request notification permission. Check browser site settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`News notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setToast('');
        }}
        className="icon-button relative min-h-[44px] min-w-[44px]"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Notification Inbox */}
      {open && (
        <section
          aria-label="News notification inbox"
          className="fixed top-14 right-2 sm:right-6 z-50 w-[min(380px,calc(100vw-16px))] max-h-[calc(100dvh-120px)] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-2xl space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">News Alerts</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Foreground feed alerts while app is open
              </p>
            </div>
            <button
              type="button"
              aria-label="Close alerts"
              className="icon-button min-h-[44px] min-w-[44px]"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Controls */}
          <div className="space-y-2 rounded-xl bg-[var(--bg-subtle)] p-3 text-xs">
            <label className="flex items-center gap-2.5 font-medium min-h-[32px] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })}
                className="h-4 w-4 rounded accent-[var(--accent-primary)]"
              />
              <span>Enable live news alerts</span>
            </label>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">Coverage:</span>
              <select
                aria-label="Alert coverage"
                disabled={!settings.enabled}
                value={settings.scope}
                onChange={(e) =>
                  saveSettings({ ...settings, scope: e.target.value as 'watchlist' | 'all' })
                }
                className="field text-xs py-1 px-2 h-8 w-auto rounded-lg"
              >
                <option value="watchlist">Watchlist only ({symbols.length})</option>
                <option value="all">All market news</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-[var(--text-secondary)] min-h-[32px] cursor-pointer">
              <input
                type="checkbox"
                disabled={!settings.enabled}
                checked={settings.quiet}
                onChange={(e) => saveSettings({ ...settings, quiet: e.target.checked })}
                className="h-4 w-4 rounded accent-[var(--accent-primary)]"
              />
              <span>Quiet hours (10 PM – 8 AM)</span>
            </label>

            <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={
                  settings.device
                    ? () => saveSettings({ ...settings, device: false })
                    : requestDeviceAlerts
                }
                className="button-secondary text-xs min-h-[36px]"
              >
                {settings.device ? 'Disable system notifications' : 'Enable system notifications'}
              </button>
            </div>
          </div>

          {/* Hosting & Architecture Transparency Note */}
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-[10px] leading-relaxed text-[var(--text-muted)] space-y-1">
            <p className="font-semibold text-[var(--text-secondary)] flex items-center gap-1">
              <ShieldAlert size={12} className="text-amber-500" />
              <span>Hosting transparency</span>
            </p>
            <p>
              This app is deployed on Vercel serverless. Foreground news alerts trigger while you have the app open. Closed-app background push notifications require a dedicated 24/7 background worker & push server.
            </p>
            {onOpenBackgroundSetup && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenBackgroundSetup();
                }}
                className="text-[var(--accent-text)] underline block pt-0.5"
              >
                View background push requirements
              </button>
            )}
          </div>

          {message && (
            <p role="status" className="text-xs text-amber-500 font-medium">
              {message}
            </p>
          )}

          {/* Inbox Feed */}
          <div className="border-t border-[var(--border-subtle)] pt-2.5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recent Alerts ({notices.length})
              </h3>
              {notices.length > 0 && (
                <button
                  type="button"
                  onClick={() => saveNotices(notices.map((n) => ({ ...n, read: true })))}
                  className="text-[11px] text-[var(--accent-text)] hover:underline flex items-center gap-1"
                >
                  <Check size={12} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {!notices.length ? (
              <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                {settings.enabled
                  ? 'No new alerts yet. Fresh matching stories will arrive here.'
                  : 'Alerts are currently paused. Turn on alerts above to start.'}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] max-h-56 overflow-y-auto">
                {notices.map((notice) => (
                  <button
                    key={notice.id}
                    type="button"
                    onClick={() => {
                      saveNotices(
                        notices.map((n) => (n.id === notice.id ? { ...n, read: true } : n))
                      );
                      setOpen(false);
                      onOpenNews();
                    }}
                    className="w-full text-left py-2.5 px-1 hover:bg-[var(--bg-surface-hover)] transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--text-muted)]">
                      <span>{notice.source ?? 'Market Wire'}</span>
                      <span>{new Date(notice.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p
                      className={`mt-1 line-clamp-2 leading-snug ${
                        notice.read
                          ? 'text-[var(--text-secondary)] font-normal'
                          : 'text-[var(--text-primary)] font-semibold'
                      }`}
                    >
                      {notice.headline}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Floating Toast when alert arrives */}
      {toast && !open && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-xl max-w-[calc(100vw-32px)]"
        >
          <button
            type="button"
            className="text-xs font-medium text-left text-[var(--text-primary)]"
            onClick={() => {
              setOpen(true);
              setToast('');
            }}
          >
            {toast} · <span className="text-[var(--accent-text)] underline">View</span>
          </button>
          <button
            type="button"
            className="icon-button min-h-[32px] min-w-[32px] p-1"
            aria-label="Dismiss alert toast"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
