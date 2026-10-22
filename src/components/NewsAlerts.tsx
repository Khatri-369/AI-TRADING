import { useEffect, useRef, useState } from 'react';
import { Bell, X, Check, Sparkles, TrendingUp, TrendingDown, Play } from 'lucide-react';
import { z } from 'zod';
import type { NewsArticle, Quote } from '../types/market';
import { useWatchlist } from '../hooks/useWatchlist';
import { formatPercent } from '../utils/format';
import { hasActiveBackgroundPush } from '../utils/backgroundPush';
import AssetIcon from './AssetIcon';

import {
  STORAGE_ALERT_INBOX,
  STORAGE_ALERT_SETTINGS,
  AlertSettings,
  getStoredAlertSettings,
  saveStoredAlertSettings,
  sendSystemNotification,
  requestNotificationPermission,
  MarketAlertTriggerPayload,
} from '../utils/notifications';

const STORAGE_INBOX = STORAGE_ALERT_INBOX;

const noticeSchema = z.object({
  id: z.string(),
  headline: z.string(),
  time: z.string(),
  read: z.boolean(),
  source: z.string().optional(),
  relatedAssets: z.array(z.string()).optional(),
});
const noticesSchema = z.array(noticeSchema);

type Notice = z.infer<typeof noticeSchema>;

interface ActiveAlert {
  id: string;
  headline: string;
  source: string;
  time: string;
  relatedStocks: Quote[];
  relatedSymbols: string[];
}

interface Props {
  newsArticles: NewsArticle[];
  quotes?: Quote[];
  onSelectAsset?: (quote: Quote) => void;
  onOpenNews: () => void;
  onOpenBackgroundSetup?: () => void;
}

function getRelatedQuotes(assetSymbols: string[] | undefined, quotes: Quote[] = []): Quote[] {
  if (!assetSymbols || !assetSymbols.length || !quotes.length) return [];
  return assetSymbols
    .map((sym) => quotes.find((q) => q.symbol === sym))
    .filter((q): q is Quote => Boolean(q));
}

export default function NewsAlerts({
  newsArticles,
  quotes = [],
  onSelectAsset,
  onOpenNews,
  onOpenBackgroundSetup,
}: Props) {
  const { symbols } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Settings
  const [settings, setSettings] = useState<AlertSettings>(getStoredAlertSettings);

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
  const [pendingDeviceAlerts, setPendingDeviceAlerts] = useState<NewsArticle[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const saveSettings = (next: AlertSettings) => {
    setSettings(next);
    saveStoredAlertSettings(next);
  };

  // Sync with global settings updates and handle test notification triggers
  useEffect(() => {
    const handleSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent<AlertSettings>;
      if (custom.detail) {
        setSettings(custom.detail);
      }
    };

    const handleTriggerTest = (e: Event) => {
      const custom = e as CustomEvent<MarketAlertTriggerPayload>;
      const payload = custom.detail || {};
      const fallbackArticle = newsArticles[0] ?? {
        id: `test-news-${Date.now()}`,
        headline: 'Test notification — TRADEXA alerts are working',
        summary: 'Intraday updates on leading equities.',
        source: 'Tradexa News Wire',
        url: '/news',
        publishedAt: new Date().toISOString(),
        relatedAssets: [],
      };

      const headline = payload.headline || fallbackArticle.headline;
      const source = payload.source || fallbackArticle.source || 'Tradexa Wire';
      const time = payload.time || fallbackArticle.publishedAt || new Date().toISOString();
      const id = payload.id || fallbackArticle.id || `test-${Date.now()}`;
      const relatedStocks = payload.relatedStocks !== undefined
        ? payload.relatedStocks
        : getRelatedQuotes(fallbackArticle.relatedAssets, quotes);

      const resolvedStocks = relatedStocks;

      setActiveAlert({
        id,
        headline,
        source,
        time,
        relatedStocks: resolvedStocks,
        relatedSymbols: payload.relatedStocks !== undefined ? payload.relatedStocks.map(stock => stock.symbol) : fallbackArticle.relatedAssets,
      });

      // Add to inbox
      setNotices((prev) => {
        const nextNotice: Notice = {
          id,
          headline,
          time,
          read: false,
          source,
          relatedAssets: resolvedStocks.map((s) => s.symbol),
        };
        const updated = [nextNotice, ...prev.filter((n) => n.id !== id)].slice(0, 20);
        try {
          localStorage.setItem(STORAGE_INBOX, JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    };

    window.addEventListener('market-alert-settings-changed', handleSettingsChanged);
    const backgroundStatus = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('market-background-push-status', backgroundStatus);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_ALERT_SETTINGS || event.key === null) setSettings(getStoredAlertSettings());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('market-alert-trigger-test', handleTriggerTest);
    return () => {
      window.removeEventListener('market-alert-settings-changed', handleSettingsChanged);
      window.removeEventListener('market-background-push-status', backgroundStatus);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('market-alert-trigger-test', handleTriggerTest);
    };
  }, [newsArticles, quotes]);

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

  // Active Alert Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(() => {
      setActiveAlert(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeAlert]);

  // Baseline establishment and feed monitoring
  useEffect(() => {
    if (!newsArticles.length) return;

    // Establish baseline on first load so we never dump historical items on start
    if (baselineRef.current === null) {
      baselineRef.current = new Set(newsArticles.map((a) => a.id));
      return;
    }

    if (!settings.enabled) {
      baselineRef.current = new Set([...baselineRef.current, ...newsArticles.map(a => a.id)].slice(-500));
      return;
    }

    const now = Date.now();
    const currentHour = new Date().getHours();

    // Respect quiet hours (10 PM to 8 AM local time) if quiet is toggled on
    if (settings.quiet && (currentHour >= 22 || currentHour < 8)) {
      baselineRef.current = new Set([...baselineRef.current, ...newsArticles.map((a) => a.id)].slice(-500));
      return;
    }

    // Filter truly new articles (accommodate aggregation delay and clock skew up to 24h)
    const freshArticles = newsArticles.filter((article) => {
      if (baselineRef.current?.has(article.id)) return false;
      const pubTime = Date.parse(article.publishedAt);
      if (Number.isNaN(pubTime)) return false;
      // Accept recent news within 24 hours
      if (pubTime < now - 24 * 3600 * 1000) return false;
      return true;
    });

    baselineRef.current = new Set([...baselineRef.current, ...newsArticles.map((a) => a.id)].slice(-500));

    if (!freshArticles.length) return;

    // Scope check: watchlist only vs all market (checks both relatedAssets and text content)
    const matching = freshArticles.filter((a) => {
      if (settings.scope === 'all') return true;
      const hasRelated = a.relatedAssets?.some((sym) =>
        symbols.some((s) => s.toUpperCase() === sym.toUpperCase())
      );
      if (hasRelated) return true;
      const text = `${a.headline} ${a.summary ?? ''}`.toUpperCase();
      return symbols.some((s) => text.includes(s.toUpperCase()));
    });

    if (!matching.length) return;

    const newForInbox = matching.filter((a) => !notices.some((n) => n.id === a.id));
    if (!newForInbox.length) return;

    const newNotices: Notice[] = newForInbox.map((a) => ({
      id: a.id,
      headline: a.headline.slice(0, 300),
      time: a.publishedAt,
      read: false,
      source: a.source,
      relatedAssets: a.relatedAssets,
    }));

    const updated = [...newNotices, ...notices].slice(0, 20);
    saveNotices(updated);

    // Display first new story on-screen with real stock changes
    const topStory = newForInbox[0];
    const related = getRelatedQuotes(topStory.relatedAssets, quotes);
    setActiveAlert({
      id: topStory.id,
      headline: topStory.headline,
      source: topStory.source ?? 'Market Wire',
      time: topStory.publishedAt,
      relatedStocks: related,
      relatedSymbols: topStory.relatedAssets,
    });

    // Queue instead of dropping stories that arrive during the cooldown.
    if (
      settings.device &&
      !hasActiveBackgroundPush() &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      setPendingDeviceAlerts(previous => [...previous, topStory].slice(-20));
    }
  }, [newsArticles, settings, symbols, notices, quotes]);

  useEffect(() => {
    if (!pendingDeviceAlerts.length) return;
    const hour = new Date().getHours();
    if (!settings.enabled || !settings.device || (settings.quiet && (hour >= 22 || hour < 8))) {
      setPendingDeviceAlerts([]);
      return;
    }
    const timer = setTimeout(() => {
      const story = pendingDeviceAlerts[0];
      const currentHour = new Date().getHours();
      setPendingDeviceAlerts(previous => previous.filter(item => item.id !== story.id));
      if (settings.quiet && (currentHour >= 22 || currentHour < 8)) return;
      lastDeviceNotifyTime.current = Date.now();
      void sendSystemNotification(story.headline, story.source, getRelatedQuotes(story.relatedAssets, quotes), story.id, story.relatedAssets, story.url)
        .then(sent => { if (!sent) setMessage('News arrived in your inbox, but the device notification could not be shown. Check browser notification permissions.'); });
    }, Math.max(0, 30_000 - (Date.now() - lastDeviceNotifyTime.current)));
    return () => clearTimeout(timer);
  }, [pendingDeviceAlerts, settings, quotes]);

  // Request browser notification permission & immediately trigger a live verification alert
  const handleAllowNotification = async () => {
    setBusy(true);
    setMessage('');
    const granted = await requestNotificationPermission();

    const nextSettings: AlertSettings = {
      ...settings,
      enabled: true,
      device: granted,
      scope: symbols.length > 0 ? settings.scope : 'all',
    };
    saveSettings(nextSettings);

    // Pick top news story to immediately show the active alert with related stock changes
    const topArticle = newsArticles[0] ?? {
      id: `live-alert-${Date.now()}`,
      headline: 'Test notification — TRADEXA alerts are working',
      summary: 'Market participants track domestic flows and global momentum.',
      source: 'Tradexa News Wire',
      url: '/news',
      publishedAt: new Date().toISOString(),
      relatedAssets: [],
    };

    const related = getRelatedQuotes(topArticle.relatedAssets, quotes);
    const fallbackRelated = related;

    // Trigger on-screen banner on mobile screen
    setActiveAlert({
      id: topArticle.id,
      headline: topArticle.headline,
      source: topArticle.source ?? 'Market Wire',
      time: topArticle.publishedAt,
      relatedStocks: fallbackRelated,
      relatedSymbols: topArticle.relatedAssets,
    });

    // Add to inbox
    if (!notices.some((n) => n.id === topArticle.id)) {
      saveNotices([
        {
          id: topArticle.id,
          headline: topArticle.headline,
          time: topArticle.publishedAt,
          read: false,
          source: topArticle.source,
          relatedAssets: topArticle.relatedAssets,
        },
        ...notices,
      ]);
    }

    // Trigger device notification via Service Worker / Notification API
    if (granted) {
      void sendSystemNotification(
        topArticle.headline,
        topArticle.source ?? 'Market Wire',
        fallbackRelated,
        topArticle.id,
        topArticle.relatedAssets,
        topArticle.url
      );
      setMessage('Mobile system & on-screen news alerts enabled!');
    } else {
      setMessage('On-screen breaking alerts active (system notifications were not enabled in browser).');
    }

    setBusy(false);
  };

  // Trigger on-screen & device test alert with live stock changes
  const handleTestAlert = () => {
    const topArticle = newsArticles[0] ?? {
      id: `test-news-${Date.now()}`,
      headline: 'Test notification — TRADEXA alerts are working',
      summary: 'Intraday updates on leading equities.',
      source: 'Tradexa Wire',
      url: '/news',
      publishedAt: new Date().toISOString(),
      relatedAssets: [],
    };

    const related = getRelatedQuotes(topArticle.relatedAssets, quotes);
    const fallbackRelated = related;

    setActiveAlert({
      id: topArticle.id,
      headline: topArticle.headline,
      source: topArticle.source ?? 'Market Wire',
      time: topArticle.publishedAt,
      relatedStocks: fallbackRelated,
      relatedSymbols: topArticle.relatedAssets,
    });

    const isDeviceAllowed =
      settings.device || (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    if (isDeviceAllowed && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      void sendSystemNotification(
        topArticle.headline,
        topArticle.source ?? 'Market Wire',
        fallbackRelated,
        topArticle.id,
        topArticle.relatedAssets,
        topArticle.url
      );
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
              <h2 className="text-sm font-bold text-[var(--text-primary)]">News & Stock Alerts</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Live news with positive/negative stock changes
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

          {/* Prominent Quick-Action Allow Button */}
          {(!settings.device || !settings.enabled) && (
            <div className="rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-subtle)] p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-text)]">
                <Sparkles size={14} />
                <span>Allow Live Mobile Notifications</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Receive market headlines with article-linked stocks and available price changes.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleAllowNotification}
                className="button-primary text-xs min-h-[38px] w-full flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bell size={14} />
                <span>Allow & Enable News Alerts</span>
              </button>
            </div>
          )}

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
                    : handleAllowNotification
                }
                className="button-secondary text-xs min-h-[36px] flex-1"
              >
                {settings.device ? 'Disable system notifications' : 'Enable system notifications'}
              </button>
              <button
                type="button"
                onClick={handleTestAlert}
                title="Trigger a test alert on your screen with stock changes"
                className="button-secondary text-xs min-h-[36px] flex items-center gap-1 shrink-0"
              >
                <Play size={12} />
                <span>Test Alert</span>
              </button>
            </div>
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
                  className="text-[11px] text-[var(--accent-text)] hover:underline flex items-center gap-1 cursor-pointer"
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
                {notices.map((notice) => {
                  const relatedStocks = getRelatedQuotes(notice.relatedAssets, quotes);
                  return (
                    <div
                      key={notice.id}
                      className="py-2.5 px-1 hover:bg-[var(--bg-surface-hover)] transition text-xs space-y-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          saveNotices(
                            notices.map((n) => (n.id === notice.id ? { ...n, read: true } : n))
                          );
                          setOpen(false);
                          onOpenNews();
                        }}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--text-muted)]">
                          <span>{notice.source ?? 'Market Wire'}</span>
                          <span>
                            {new Date(notice.time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
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

                      {/* Related stock changes (positive / negative) */}
                      {relatedStocks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {relatedStocks.map((stock) => {
                            const isGain = (stock.changePercent ?? 0) >= 0;
                            return (
                              <button
                                key={stock.symbol}
                                type="button"
                                onClick={() => {
                                  setOpen(false);
                                  if (onSelectAsset) {
                                    onSelectAsset(stock);
                                  } else {
                                    onOpenNews();
                                  }
                                }}
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition cursor-pointer ${
                                  isGain
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                                }`}
                              >
                                <AssetIcon symbol={stock.symbol} category={stock.category} size="xs" />
                                <span>{stock.symbol}</span>
                                <span className="flex items-center">
                                  {isGain ? (
                                    <TrendingUp className="h-2.5 w-2.5" />
                                  ) : (
                                    <TrendingDown className="h-2.5 w-2.5" />
                                  )}
                                  {formatPercent(stock.changePercent)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Floating Active Alert Banner on Mobile / Desktop Screen */}
      {activeAlert && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-14 sm:top-16 inset-x-2 sm:inset-x-auto sm:right-6 sm:w-96 z-50 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                Breaking Market Alert
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">· {activeAlert.source}</span>
            </div>
            <button
              type="button"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 -mr-1 -mt-1 cursor-pointer"
              onClick={() => setActiveAlert(null)}
              aria-label="Dismiss alert"
            >
              <X size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveAlert(null);
              onOpenNews();
            }}
            className="mt-1.5 text-left text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-text)] line-clamp-2 transition cursor-pointer w-full block"
          >
            {activeAlert.headline}
          </button>

          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
            {activeAlert.relatedSymbols.length ? `Related stocks: ${activeAlert.relatedSymbols.join(', ')}` : 'No specific stock identified'}
          </p>
          {/* Quotes are context, not evidence the headline caused the price change. */}
          {activeAlert.relatedStocks.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Current quote change:</span>
              {activeAlert.relatedStocks.map((stock) => {
                const isGain = (stock.changePercent ?? 0) >= 0;
                return (
                  <button
                    key={stock.symbol}
                    type="button"
                    onClick={() => {
                      setActiveAlert(null);
                      if (onSelectAsset) {
                        onSelectAsset(stock);
                      } else {
                        onOpenNews();
                      }
                    }}
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold transition cursor-pointer ${
                      isGain
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30'
                    }`}
                  >
                    <AssetIcon symbol={stock.symbol} category={stock.category} size="xs" />
                    <span>{stock.symbol}</span>
                    <span className="flex items-center gap-0.5">
                      {isGain ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatPercent(stock.changePercent)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
