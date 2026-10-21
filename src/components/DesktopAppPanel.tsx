import { useEffect, useRef, useState } from 'react';
import { Bell, Download, X } from 'lucide-react';
import { z } from 'zod';
import { syncBackgroundPush, hasActiveBackgroundPush } from '../utils/backgroundPush';
import { getStoredAlertSettings, saveStoredAlertSettings, requestNotificationPermission } from '../utils/notifications';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const configSchema = z.object({ configured: z.boolean(), publicKey: z.string().nullable(), intervalMinutes: z.number(), provider: z.string().optional() });
async function updateSubscription(action: 'subscribe' | 'unsubscribe', subscription: PushSubscription) {
  const response = await fetch(`/api/notifications/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(subscription.toJSON()), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('The server could not save your notification preference. Please try again.');
}
function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
export default function DesktopAppPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [config, setConfig] = useState<z.infer<typeof configSchema> | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const complete = () => { setInstalled(true); setInstall(null); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', complete); };
  }, []);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const controller = new AbortController();
    setConfig(null); setMessage('');
    void fetch('/api/notifications/config', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const value = configSchema.parse(await response.json());
      if (!controller.signal.aborted) setConfig(value);
    }).catch(() => { if (!controller.signal.aborted) setMessage('Notification settings are unavailable. Close this panel and try again.'); });
    if (supported) void navigator.serviceWorker.getRegistration().then(async registration => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!controller.signal.aborted) setSubscribed(Boolean(subscription));
    }).catch(() => undefined);
    return () => controller.abort();
  }, [open, supported]);
  useEffect(() => {
    const update = (event: Event) => { setMessage((event as CustomEvent<string>).detail); setSubscribed(hasActiveBackgroundPush()); };
    window.addEventListener('market-background-push-status', update);
    return () => window.removeEventListener('market-background-push-status', update);
  }, []);
  async function enable() {
    if (config?.provider === 'onesignal') {
      setBusy(true);
      try {
        if (!await requestNotificationPermission()) { setMessage('On iPhone, open the Safari-installed Home Screen app (iOS 16.4+). Otherwise allow notifications in browser site settings.'); return; }
        saveStoredAlertSettings({ ...getStoredAlertSettings(), enabled: true, device: true });
        const result = await Promise.race([
          syncBackgroundPush(),
          new Promise<string>(resolve => setTimeout(() => resolve('Device registration is in progress. Keep page open to finish.'), 7000)),
        ]);
        setMessage(result ?? 'Background provider is unavailable.');
        setSubscribed(hasActiveBackgroundPush());
      } catch { setMessage('Background registration failed. Check OneSignal setup and retry.'); }
      finally { setBusy(false); }
      return;
    }
    if (!config?.publicKey || busy) return;
    setBusy(true); setMessage('');
    let created: PushSubscription | undefined;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setMessage('Notifications are not allowed. You can change this in your browser’s site permissions.'); return; }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) throw new Error('The app is still installing its background worker. Reload and try again.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey) }); created = subscription; }
      await updateSubscription('subscribe', subscription);
      setSubscribed(true); setMessage('Device subscribed. Signed-in devices follow account news preferences and price alerts. Only new matching headlines will be sent.');
    } catch (error) {
      if (created) await created.unsubscribe().catch(() => undefined);
      setMessage(error instanceof Error ? error.message : 'Could not enable notifications.');
    } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMessage('');
    try {
      if (config?.provider === 'onesignal') {
        saveStoredAlertSettings({ ...getStoredAlertSettings(), device: false });
        setMessage(await syncBackgroundPush() ?? 'Background provider is unavailable.');
        setSubscribed(hasActiveBackgroundPush());
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        // Try both operations: local revocation still protects users if the backend is down.
        let removed = true;
        try { await updateSubscription('unsubscribe', subscription); } catch { removed = false; }
        const revoked = await subscription.unsubscribe();
        if (!revoked) throw new Error('Could not revoke the browser subscription. Retry or block notifications in site permissions.');
        setMessage(removed ? 'News alerts disabled.' : 'Browser subscription revoked. The server will remove the expired record on a later delivery attempt.');
      }
      setSubscribed(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not disable alerts.'); }
    finally { setBusy(false); }
  }
  async function sendTest() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error('Enable news alerts first before sending a test alert.');
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(subscription.toJSON()),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Could not send test notification. Please verify your connection.');
      setMessage('🔔 Test accepted by the push service. Check your notification tray to confirm delivery.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send test alert.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} className="m-auto max-h-[calc(100dvh-32px)] overflow-y-auto w-[min(560px,calc(100vw-24px))] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] p-5 backdrop:bg-black/50" aria-labelledby="desktop-title">
    <div className="flex items-center justify-between gap-3"><h2 id="desktop-title" className="text-lg font-semibold">Desktop app & news alerts</h2><button className="icon-button" aria-label="Close desktop settings" onClick={onClose}><X size={18} /></button></div>
    <section className="mt-5 space-y-3">
      <div className="flex items-center gap-3">
        <img src="/icons/tradexa-192.png" alt="Tradexa Logo" className="h-10 w-10 shrink-0 rounded-xl border border-cyan-500/30 object-cover shadow-sm" />
        <div>
          <h3 className="flex items-center gap-2 font-medium"><Download size={16} />Install Tradexa on your device</h3>
          <p className="text-xs text-[var(--text-secondary)]">Progressive Web App for Android and Desktop</p>
        </div>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">Install Tradexa as a standalone Android app or desktop shortcut for quick access to your watchlist, charts, news and research.</p>
      <button className="button-primary" disabled={installed || !install} onClick={async () => { if (!install) return; try { await install.prompt(); const choice = await install.userChoice; setMessage(choice.outcome === 'accepted' ? 'Tradexa installation requested. Your browser will finish setup.' : 'Installation dismissed. You can install from the browser menu later.'); } catch { setMessage('Use your browser menu to install Tradexa.'); } finally { setInstall(null); } }}>{installed ? 'Tradexa is installed' : 'Install Tradexa App'}</button>
      {!installed && !install && <p className="text-xs leading-5 text-[var(--text-muted)]">In Android Chrome, tap the menu (⋮) and select “Install app” or “Add to Home screen”. On desktop, use Chrome/Edge “Install Tradexa”. On iPhone/iPad, use Safari → Share → Add to Home Screen.</p>}
    </section>
    <section className="mt-5 border-t border-[var(--border-subtle)] pt-5 space-y-3"><h3 className="flex items-center gap-2 font-medium"><Bell size={18} />Latest market headlines & mobile alerts</h3><p className="text-sm text-[var(--text-secondary)]">Opt in to background news alerts on mobile and desktop, even when this app’s window is closed. The server sends real-time alerts when new headlines arrive.</p>
      {!supported ? <p className="text-sm">Push notifications require a supported browser and HTTPS. On iPhone/iPad, install the app first.</p> : <>
        {config && !config.configured && <p className="text-sm">Background alerts are not configured on this server yet. News remains available in the News section.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="button-primary" disabled={busy || !config?.configured} onClick={() => void enable()}>{busy ? 'Updating…' : subscribed ? 'Renew news alerts' : 'Enable news alerts'}</button>
          {config?.provider === 'onesignal' && <button className="button-secondary" disabled={busy} onClick={() => void disable()}>Disable background alerts</button>}
          {subscribed && config?.provider !== 'onesignal' && <>
            <button className="button-secondary" disabled={busy} onClick={() => void sendTest()}>Send test alert</button>
            <button className="button-secondary" disabled={busy} onClick={() => void disable()}>Disable alerts</button>
          </>}
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-3 text-xs text-[var(--text-secondary)] space-y-1">
          <p className="font-semibold text-[var(--text-primary)]">📱 Mobile Notification Access</p>
          <p>• <strong>Android:</strong> Tap “Enable news alerts” and approve notifications in Chrome/Edge.</p>
          <p>• <strong>iPhone / iOS (16.4+):</strong> In Safari, tap <strong>Share ⎋</strong> → <strong>Add to Home Screen ⊕</strong>, then open the installed app and enable alerts.</p>
        </div>
      </>}
      <p className="text-xs leading-5 text-[var(--text-muted)]">{config?.provider === 'onesignal'
        ? 'OneSignal stores this device’s push subscription. Background alerts support All market news with Quiet hours off; other settings pause background sends. Checks run on an external schedule. Browser/OS restrictions, battery settings and connectivity can delay delivery. Use OneSignal’s dashboard to send a server test to your device, then lock the phone to verify delivery.'
        : 'Delivery depends on browser/OS settings and connectivity; alerts are not instant trading signals. Subscriptions expire after 90 days unless renewed. We store this browser’s push endpoint and encryption keys on the server to deliver alerts. Disable alerts to remove them.'}</p>
    </section>
    {message && <p role="status" className="mt-4 text-sm rounded-lg bg-[var(--bg-subtle)] p-3">{message}</p>}
  </dialog>;
}
