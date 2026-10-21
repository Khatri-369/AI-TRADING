import type { Quote } from '../types/market';
import { newsNotificationBody } from '../../shared/newsNotification';

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
        device: typeof parsed.device === 'boolean' ? parsed.device : hasGranted,
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
  // iOS requires an installed Home Screen web app and a direct user gesture.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !window.matchMedia('(display-mode: standalone)').matches && !(navigator as Navigator & { standalone?: boolean }).standalone) return false;
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
  id: string = String(Date.now()),
  relatedSymbols: string[] = relatedStocks.map(stock => stock.symbol),
  articleUrl: string = '/news'
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const title = `Tradexa · ${source || 'Market News'}`;
  const body = newsNotificationBody(headline, relatedSymbols);

  const options: NotificationOptions = {
    body,
    icon: '/icons/tradexa-192.png',
    badge: '/icons/tradexa-192.png',
    tag: `tradexa-news-${id}`,
    data: { url: articleUrl },
  };

  // 1. Try the registered service worker first without waiting indefinitely for registration.
  try {
    if ('serviceWorker' in navigator) {
      // ready never resolves if no worker is registered. Do not strand desktop delivery.
      const reg = await navigator.serviceWorker.getRegistration();
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
