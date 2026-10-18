import { useState, useEffect } from 'react';
import { BellRing, Sparkles, X, CheckCircle2 } from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendSystemNotification,
  saveStoredAlertSettings,
  getStoredAlertSettings,
} from '../utils/notifications';

const DISMISS_KEY = 'tradexa_notification_prompt_dismissed_at';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [isInstalledPrompt, setIsInstalledPrompt] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [grantedMessage, setGrantedMessage] = useState(false);

  useEffect(() => {
    // Only proceed if browser supports Notification API
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;

    const currentPermission = getNotificationPermission();
    if (currentPermission !== 'default') {
      // Permission has already been granted or denied
      return;
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const isDismissCooldown = Date.now() - dismissedAt < THREE_DAYS_MS;

    // Listen for PWA install event
    const handleAppInstalled = () => {
      setIsInstalledPrompt(true);
      setVisible(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // If running as an installed PWA and permission is default, ask immediately
    if (isStandalone && !isDismissCooldown) {
      setIsInstalledPrompt(true);
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    // For first-time visitors in regular browser, show prompt after 2.5s
    if (!isDismissCooldown) {
      const timer = setTimeout(() => {
        if (getNotificationPermission() === 'default') {
          setVisible(true);
        }
      }, 2500);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        const currentSettings = getStoredAlertSettings();
        const updated = {
          ...currentSettings,
          enabled: true,
          device: true,
        };
        saveStoredAlertSettings(updated);

        // Send instant welcome notification to verify delivery
        void sendSystemNotification(
          'Tradexa Notifications Active',
          'Tradexa Market Intelligence',
          [],
          `welcome-${Date.now()}`
        );

        setGrantedMessage(true);
        setTimeout(() => {
          setVisible(false);
        }, 2200);
      } else {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setVisible(false);
      }
    } catch {
      setVisible(false);
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="notification-prompt-title"
      aria-describedby="notification-prompt-desc"
      className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300 sm:bottom-6 sm:right-6 sm:left-auto"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/35 bg-[#090d16]/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 sm:p-4.5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <img
              src="/icons/tradexa-192.png"
              alt="Tradexa Logo"
              className="h-11 w-11 rounded-xl border border-emerald-500/40 object-cover shadow-md"
            />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#090d16]" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4
                id="notification-prompt-title"
                className="flex items-center gap-1.5 text-sm font-semibold text-white"
              >
                {grantedMessage ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Notifications Enabled!</span>
                  </>
                ) : (
                  <>
                    <BellRing className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span>
                      {isInstalledPrompt ? 'App Installed! Enable Live Alerts?' : 'Turn On Live News Alerts?'}
                    </span>
                  </>
                )}
              </h4>
              {!grantedMessage && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-white transition p-1 -mr-1 cursor-pointer"
                  aria-label="Dismiss notification alert"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p
              id="notification-prompt-desc"
              className="mt-1 text-xs text-gray-300 leading-relaxed"
            >
              {grantedMessage
                ? 'You will now receive instant desktop & mobile alerts for breaking market news.'
                : 'Get instant alerts on your screen when breaking financial news and market movements occur.'}
            </p>
          </div>
        </div>

        {!grantedMessage && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={requesting}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition cursor-pointer disabled:opacity-50"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={handleEnable}
              disabled={requesting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 transition shadow-sm active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{requesting ? 'Enabling…' : 'Turn On Notifications'}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
