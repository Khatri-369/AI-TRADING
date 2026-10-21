import { z } from 'zod';
import { getStoredAlertSettings } from './notifications';

const schema = z.object({ provider: z.string().optional(), configured: z.boolean(), appId: z.string().uuid().optional() });
interface SDK {
  init(options: object): Promise<void>;
  Notifications: {
    isPushSupported(): boolean;
    requestPermission?(): Promise<boolean>;
    addEventListener(event: 'permissionChange', callback: () => void): void;
  };
  User: {
    onesignalId?: string;
    addTag(key: string, value: string): void;
    getTags(): Record<string, string>;
    addEventListener(event: 'change', callback: () => void): void;
    PushSubscription: {
      optedIn: boolean; id?: string;
      optIn(): Promise<void>; optOut(): Promise<void>;
      addEventListener(event: 'change', callback: () => void): void;
    };
  };
}
let eventTimer: ReturnType<typeof setTimeout> | undefined;
function onSubscriptionChange() {
  clearTimeout(eventTimer);
  eventTimer = setTimeout(() => {
    void syncBackgroundPush().then(message => {
      if (message) window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: message }));
    }).catch(err => {
      const detail = err instanceof Error ? err.message : 'Background registration verification failed. Retry Enable news alerts.';
      window.dispatchEvent(new CustomEvent('market-background-push-status', { detail }));
    });
  }, 800);
}
let sdkPromise: Promise<SDK> | undefined;
let backgroundActive = false;
let verifiedDevice: { key: string; at: number } | undefined;
export const hasActiveBackgroundPush = () => backgroundActive;
function loadSDK(appId: string) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<SDK>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Push setup timed out. Reload and try again.'));
    }, 15_000);
    const host = window as unknown as { OneSignalDeferred?: Array<(sdk: SDK) => void> };
    host.OneSignalDeferred = host.OneSignalDeferred ?? [];
    host.OneSignalDeferred.push(async sdk => {
      const settings = getStoredAlertSettings();
      try {
        await sdk.init({
          appId,
          serviceWorkerPath: 'sw.js',
          serviceWorkerParam: { scope: '/' },
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          autoResubscribe: settings.enabled && settings.device && settings.scope === 'all' && !settings.quiet,
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
        });
      } catch (err) {
        const msg = String(err);
        if (!msg.toLowerCase().includes('already initialized')) {
          clearTimeout(timer);
          reject(new Error('OneSignal initialization failed. Check the site origin and worker, then reload to retry.'));
          return;
        }
      }
      sdk.User.PushSubscription.addEventListener('change', onSubscriptionChange);
      sdk.User.addEventListener('change', onSubscriptionChange);
      sdk.Notifications.addEventListener('permissionChange', onSubscriptionChange);
      clearTimeout(timer);
      resolve(sdk);
    });
    const script = document.createElement('script'); script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; script.defer = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Push service could not load (check network/content blocker).'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
let queue: Promise<unknown> = Promise.resolve();
export function syncBackgroundPush(): Promise<string | null> {
  const next = queue.then(async () => {
    backgroundActive = false;
    const response = await fetch('/api/notifications/config', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Could not check background notification setup.');
    const config = schema.parse(await response.json());
    if (config.provider !== 'onesignal') return null;
    if (!config.configured || !config.appId) return 'Background news is not configured yet. Complete the OneSignal and scheduler setup.';
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 'Allow browser notifications to register this device for background news.';
    const sdk = await loadSDK(config.appId);
    if (!sdk.Notifications.isPushSupported()) return 'This browser does not support web push. On iPhone, use the Safari-installed Home Screen app on iOS 16.4 or later.';
    const settings = getStoredAlertSettings();
    const enabled = settings.enabled && settings.device && settings.scope === 'all' && !settings.quiet;
    if (!enabled) {
      verifiedDevice = undefined;
      backgroundActive = false;
      if (sdk.User.getTags().market_news !== 'off') sdk.User.addTag('market_news', 'off');
      if (sdk.User.PushSubscription.optedIn) {
        try {
          await Promise.race([
            Promise.resolve(sdk.User.PushSubscription.optOut()).catch(() => undefined),
            new Promise(resolve => setTimeout(resolve, 2000)),
          ]);
        } catch { /* safe timeout */ }
      }
      const statusMsg = settings.scope !== 'all' || settings.quiet
        ? 'Background news is paused: this free integration supports All market news with Quiet hours off. Your in-app filters still apply.'
        : 'Background news notifications are off.';
      window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: statusMsg }));
      return statusMsg;
    }
    // Native permission was already checked above. Re-requesting through the SDK
    // can wait for its prompt lifecycle and block the serialized registration queue.
    if (!sdk.User.PushSubscription.optedIn || !sdk.User.PushSubscription.id) {
      try {
        await Promise.race([
          Promise.resolve(sdk.User.PushSubscription.optIn()),
          new Promise(resolve => setTimeout(resolve, 5000)),
        ]);
      } catch {
        throw new Error('Push subscription failed. Check Chrome notification access and your network, then retry Enable news alerts.');
      }
    }
    if (!sdk.User.PushSubscription.id || !sdk.User.onesignalId) {
      for (let attempt = 0; attempt < 10; attempt++) {
        if (sdk.User.PushSubscription.id && sdk.User.onesignalId) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    if (!sdk.User.onesignalId || !sdk.User.PushSubscription.id || !sdk.User.PushSubscription.optedIn) {
      const pendingMsg = 'Device registration is pending. Keep this page open; registration will be checked when OneSignal assigns the subscription.';
      window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: pendingMsg }));
      return pendingMsg;
    }
    // addTag is synchronous and updates SDK state; it is NOT a server acknowledgement.
    if (sdk.User.getTags().market_news !== 'on') sdk.User.addTag('market_news', 'on');
    const deviceKey = `${sdk.User.onesignalId}:${sdk.User.PushSubscription.id}`;
    if (verifiedDevice?.key === deviceKey && Date.now() - verifiedDevice.at < 20000) {
      backgroundActive = true;
      const readyMsg = 'Device registered with OneSignal and All market news confirmed.';
      window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: readyMsg }));
      return readyMsg;
    }
    const verificationSchema = z.object({ registered: z.boolean(), subscribed: z.boolean(), tagged: z.boolean(), ready: z.boolean() });
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      const current = getStoredAlertSettings();
      if (!current.enabled || !current.device || current.scope !== 'all' || current.quiet) {
        const prefMsg = 'Notification preferences changed; syncing the new settings.';
        window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: prefMsg }));
        return prefMsg;
      }
      const result = await fetch('/api/notifications/verify', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ userId: sdk.User.onesignalId, subscriptionId: sdk.User.PushSubscription.id }), signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) {
        const errorMsg = 'Could not verify this device with OneSignal. Retry Enable news alerts shortly.';
        window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: errorMsg }));
        return errorMsg;
      }
      const verified = verificationSchema.parse(await result.json());
      if (verified.ready) {
        verifiedDevice = { key: deviceKey, at: Date.now() };
        backgroundActive = true;
        const successMsg = 'Device registered with OneSignal and All market news confirmed. Scheduled news can arrive with the app closed; phone settings still apply.';
        window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: successMsg }));
        return successMsg;
      }
      if (attempt === 2) {
        const failMsg = !verified.registered || !verified.subscribed
          ? 'Permission is allowed, but OneSignal has not confirmed an active push subscription. Check the site domain and retry Enable news alerts.'
          : 'Device subscribed, but the market_news tag is not confirmed. Check OneSignal tag limits and retry Enable news alerts.';
        window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: failMsg }));
        return failMsg;
      }
    }
    const fallbackMsg = 'Device registration is pending.';
    window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: fallbackMsg }));
    return fallbackMsg;
  });
  queue = next.catch(() => undefined);
  return next;
}

export function startBackgroundPushSync() {
  let active = true;
  const sync = () => {
    // Never prompt on load. Registration follows the user's existing permission and settings.
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void syncBackgroundPush().then(message => {
      if (active && message) window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: message }));
    }).catch(err => {
      const detail = err instanceof Error ? err.message : 'Background registration verification failed. Retry Enable news alerts.';
      if (active) window.dispatchEvent(new CustomEvent('market-background-push-status', { detail }));
    });
  };
  const storage = (event: StorageEvent) => { if (event.key === 'markets.alerts.settings.v1' || event.key === null) sync(); };
  sync();
  window.addEventListener('market-alert-settings-changed', sync);
  window.addEventListener('storage', storage);
  window.addEventListener('online', sync);
  return () => { active = false; window.removeEventListener('market-alert-settings-changed', sync); window.removeEventListener('storage', storage); window.removeEventListener('online', sync); };
}
