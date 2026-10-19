import { z } from 'zod';
import { getStoredAlertSettings } from './notifications';

const schema = z.object({ provider: z.string().optional(), configured: z.boolean(), appId: z.string().uuid().optional() });
interface SDK {
  init(options: object): Promise<void>;
  User: { addTag(key: string, value: string): Promise<void>; PushSubscription: { optedIn: boolean; id?: string; optIn(): Promise<void>; optOut(): Promise<void> } };
}
let sdkPromise: Promise<SDK> | undefined;
let backgroundActive = false;
export const hasActiveBackgroundPush = () => backgroundActive;
function loadSDK(appId: string) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<SDK>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Push setup timed out. Reload and try again.')), 15_000);
    const host = window as unknown as { OneSignalDeferred?: Array<(sdk: SDK) => void> };
    host.OneSignalDeferred = host.OneSignalDeferred ?? [];
    host.OneSignalDeferred.push(sdk => {
      void sdk.init({ appId, serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/onesignal/' },
        notifyButton: { enable: false }, welcomeNotification: { disable: true }, autoResubscribe: false,
        promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
      }).then(() => { clearTimeout(timer); resolve(sdk); }, () => { clearTimeout(timer); reject(new Error('Push setup failed. Check the OneSignal site domain and worker configuration.')); });
    });
    const script = document.createElement('script'); script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; script.defer = true;
    script.onerror = () => { clearTimeout(timer); reject(new Error('Push service could not load. Check your connection or content blocker.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
let queue: Promise<unknown> = Promise.resolve();
export function syncBackgroundPush(): Promise<string | null> {
  const next = queue.then(async () => {
    const response = await fetch('/api/notifications/config', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Could not check background notification setup.');
    const config = schema.parse(await response.json());
    if (config.provider !== 'onesignal') return null;
    if (!config.configured || !config.appId) return 'Background news is not configured yet. Complete the OneSignal and scheduler setup.';
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 'Allow browser notifications to register this device for background news.';
    const sdk = await loadSDK(config.appId);
    const settings = getStoredAlertSettings();
    const enabled = settings.enabled && settings.device && settings.scope === 'all' && !settings.quiet;
    if (!enabled) {
      backgroundActive = false;
      await sdk.User.addTag('market_news', 'off');
      await sdk.User.PushSubscription.optOut();
      return settings.scope !== 'all' || settings.quiet
        ? 'Background news is paused: this free integration supports All market news with Quiet hours off. Your in-app filters still apply.'
        : 'Background news notifications are off.';
    }
    await sdk.User.PushSubscription.optIn();
    await sdk.User.addTag('market_news', 'on');
    backgroundActive = Boolean(sdk.User.PushSubscription.optedIn && sdk.User.PushSubscription.id);
    return sdk.User.PushSubscription.optedIn && sdk.User.PushSubscription.id
      ? 'Device registered with OneSignal. Scheduled news can arrive with the app closed; delivery depends on the scheduler and phone settings.'
      : 'Device registration is pending. Check background setup again shortly.';
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
    }).catch(() => {
      if (active) window.dispatchEvent(new CustomEvent('market-background-push-status', { detail: 'Background push setup failed. Open Desktop app & news alerts to retry.' }));
    });
  };
  const storage = (event: StorageEvent) => { if (event.key === 'markets.alerts.settings.v1' || event.key === null) sync(); };
  sync();
  window.addEventListener('market-alert-settings-changed', sync);
  window.addEventListener('storage', storage);
  return () => { active = false; window.removeEventListener('market-alert-settings-changed', sync); window.removeEventListener('storage', storage); };
}
