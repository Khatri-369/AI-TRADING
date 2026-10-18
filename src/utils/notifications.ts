import type { Quote } from '../types/market';
import { formatPrice } from './format';

export const STORAGE_ALERT_SETTINGS = 'markets.alerts.settings.v1';
export const STORAGE_ALERT_INBOX = 'markets.alerts.inbox.v1';

export interface AlertSettings {
  enabled: boolean;
  scope: 'watchlist' | 'all';
  quiet: boolean;
  device: boolean;
}

export const defaultAlertSettings: AlertSettings = {
  enabled: true,
  scope: 'all',
  quiet: false,
  device: false,
};

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getStoredAlertSettings(): AlertSettings {
  if (typeof window === 'undefined') return defaultAlertSettings;
  try {
    const raw = localStorage.getItem(STORAGE_ALERT_SETTINGS);
    const hasGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultAlertSettings.enabled,
        scope: parsed.scope === 'watchlist' ? 'watchlist' : 'all',
        quiet: typeof parsed.quiet === 'boolean' ? parsed.quiet : defaultAlertSettings.quiet,
        device: typeof parsed.device === 'boolean' ? (parsed.device || hasGranted) : hasGranted,
      };
    }
    return {
      ...defaultAlertSettings,
      device: hasGranted,
    };
  } catch {
    // Ignore JSON parsing errors
  }
  return defaultAlertSettings;
}

export function saveStoredAlertSettings(next: AlertSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_ALERT_SETTINGS, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent<AlertSettings>('market-alert-settings-changed', {
        detail: next,
      })
    );
  } catch {
    // Suppress storage quota errors
  }
}

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export async function sendSystemNotification(
  headline: string,
  source: string,
  relatedStocks: Quote[] = [],
  id: string = String(Date.now())
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const stockSummary =
    relatedStocks.length > 0
      ? relatedStocks
          .map(
            (s) =>
              `${s.symbol} ${(s.changePercent ?? 0) >= 0 ? '+' : ''}${
                s.changePercent !== null ? s.changePercent.toFixed(2) : '0.00'
              }%`
          )
          .join(', ')
      : '';

  const title = stockSummary ? `Tradexa · ${stockSummary}` : `Tradexa · ${source || 'Market News'}`;

  const stockDetails = relatedStocks
    .map(
      (s) =>
        `${(s.changePercent ?? 0) >= 0 ? '🟢' : '🔴'} ${s.symbol}: ${formatPrice(s.price, s.currency)} (${
          (s.changePercent ?? 0) >= 0 ? '+' : ''
        }${s.changePercent !== null ? s.changePercent.toFixed(2) : '0.00'}%)`
    )
    .join('\n');

  const body = stockDetails ? `${headline}\n\n${stockDetails}` : headline;

  const options: NotificationOptions = {
    body,
    icon: '/icons/tradexa-192.png',
    badge: '/icons/tradexa-192.png',
    tag: `tradexa-news-${id}`,
    data: { url: '/news' },
  };

  // 1. Try ServiceWorkerRegistration.showNotification first with 500ms timeout
  try {
    if ('serviceWorker' in navigator) {
      const swReady = navigator.serviceWorker.ready;
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      const reg = (await Promise.race([swReady, timeout])) as ServiceWorkerRegistration | null;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Continue to constructor fallback
  }

  // 2. Fallback to desktop Notification constructor
  try {
    const notif = new Notification(title, options);
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus error
      }
    };
    return true;
  } catch {
    return false;
  }
}

export interface MarketAlertTriggerPayload {
  id?: string;
  headline?: string;
  source?: string;
  time?: string;
  relatedStocks?: Quote[];
}

export function triggerMarketAlertTest(payload?: MarketAlertTriggerPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MarketAlertTriggerPayload>('market-alert-trigger-test', {
      detail: payload ?? {},
    })
  );
}
