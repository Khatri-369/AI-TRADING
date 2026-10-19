import { useState, useEffect, useCallback } from 'react';
import type { Quote } from '../types/market';
import {
  AlertSettings,
  getNotificationPermission,
  getStoredAlertSettings,
  NotificationPermissionState,
  requestNotificationPermission,
  saveStoredAlertSettings,
  sendSystemNotification,
  triggerMarketAlertTest,
} from '../utils/notifications';

export function useNewsAlertSettings() {
  const [settings, setSettings] = useState<AlertSettings>(getStoredAlertSettings);
  const [permission, setPermission] = useState<NotificationPermissionState>(getNotificationPermission);
  const [requesting, setRequesting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sync settings when modified elsewhere (cross-component or cross-tab)
  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<AlertSettings>;
      if (custom.detail) {
        setSettings(custom.detail);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'markets.alerts.settings.v1') {
        setSettings(getStoredAlertSettings());
      }
    };
    window.addEventListener('market-alert-settings-changed', handleCustomChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('market-alert-settings-changed', handleCustomChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Update permission status on mount
  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  // Clear feedback message after 5 seconds
  useEffect(() => {
    if (!feedbackMessage) return;
    const t = setTimeout(() => setFeedbackMessage(null), 5000);
    return () => clearTimeout(t);
  }, [feedbackMessage]);

  const updateSettings = useCallback((partial: Partial<AlertSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveStoredAlertSettings(next);
      return next;
    });
  }, []);

  const toggleEnabled = useCallback(async () => {
    let deviceAllowed = settings.device;
    const currentPerm = getNotificationPermission();

    if (!settings.enabled) {
      if (currentPerm === 'default') {
        const granted = await requestNotificationPermission();
        deviceAllowed = granted;
        setPermission(getNotificationPermission());
      } else if (currentPerm === 'granted') {
        deviceAllowed = true;
      }
    }

    setSettings((prev) => {
      const willEnable = !prev.enabled;
      const next = {
        ...prev,
        enabled: willEnable,
        device: willEnable ? (deviceAllowed || prev.device) : prev.device,
      };
      saveStoredAlertSettings(next);
      setFeedbackMessage(
        next.enabled
          ? 'News notifications enabled! Breaking market alerts will appear.'
          : 'News notifications disabled. Alerts are currently muted.'
      );
      return next;
    });
  }, [settings.enabled, settings.device]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      let deviceAllowed = settings.device;
      const currentPerm = getNotificationPermission();

      if (enabled) {
        if (currentPerm === 'default') {
          const granted = await requestNotificationPermission();
          deviceAllowed = granted;
          setPermission(getNotificationPermission());
        } else if (currentPerm === 'granted') {
          deviceAllowed = true;
        }
      }

      updateSettings({ enabled, ...(enabled && deviceAllowed ? { device: true } : {}) });
      setFeedbackMessage(
        enabled
          ? 'News notifications enabled! Breaking market alerts will appear.'
          : 'News notifications disabled. Alerts are currently muted.'
      );
    },
    [updateSettings, settings.device]
  );

  const toggleDeviceNotifications = useCallback(async () => {
    if (settings.device) {
      updateSettings({ device: false });
      setFeedbackMessage('Device notifications disabled. In-app alerts remain active.');
      return;
    }

    setRequesting(true);
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    setRequesting(false);

    if (granted) {
      updateSettings({ enabled: true, device: true });
      setFeedbackMessage('Device notifications enabled while the app is running. Closed-app alerts require background push setup.');
      // Send a confirmation system notification
      void sendSystemNotification(
        'Tradexa Notifications Active',
        'Tradexa Market Intelligence',
        [],
        `welcome-${Date.now()}`
      );
    } else {
      updateSettings({ device: false });
      setFeedbackMessage(
        'Notification permission was not granted by your browser. Please allow notifications in site settings.'
      );
    }
  }, [settings.device, updateSettings]);

  const setScope = useCallback(
    (scope: 'all' | 'watchlist') => {
      updateSettings({ scope });
    },
    [updateSettings]
  );

  const setQuiet = useCallback(
    (quiet: boolean) => {
      updateSettings({ quiet });
    },
    [updateSettings]
  );

  const sendTestAlert = useCallback(
    (quotes: Quote[] = []) => {
      const currentPerm = getNotificationPermission();
      const testArticle = {
        id: `test-news-${Date.now()}`,
        headline: 'Market Update: Sector leaders show volume momentum and price action',
        source: 'Tradexa News Wire',
        time: new Date().toISOString(),
        relatedStocks: quotes.slice(0, 3),
      };

      triggerMarketAlertTest(testArticle);

      const shouldSendDevice = (settings.device || currentPerm === 'granted') && currentPerm === 'granted';
      if (shouldSendDevice) {
        if (!settings.device) {
          updateSettings({ device: true });
        }
        void sendSystemNotification(
          testArticle.headline,
          testArticle.source,
          testArticle.relatedStocks,
          testArticle.id
        );
      }

      setFeedbackMessage('Test alert dispatched! Check your screen and notification center.');
    },
    [settings.device, updateSettings]
  );

  return {
    settings,
    permission,
    requesting,
    feedbackMessage,
    setFeedbackMessage,
    toggleEnabled,
    setEnabled,
    toggleDeviceNotifications,
    setScope,
    setQuiet,
    sendTestAlert,
    updateSettings,
  };
}
