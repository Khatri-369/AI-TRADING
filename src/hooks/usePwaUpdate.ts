import { useEffect, useState, useCallback, useRef } from 'react';

export function usePwaUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) {
      return;
    }

    let refreshing = false;

    // When the new worker takes control, reload the app to run the new version
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const checkRegistration = (reg: ServiceWorkerRegistration) => {
      registrationRef.current = reg;

      // 1. If a worker is already waiting, an update is ready
      if (reg.waiting && navigator.serviceWorker.controller) {
        setHasUpdate(true);
      }

      // 2. Listen for newly discovered updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // If installed and there's already an active controller, this is an update!
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setHasUpdate(true);
          }
        });
      });
    };

    // Obtain current or pending registration
    navigator.serviceWorker.ready
      .then(reg => checkRegistration(reg))
      .catch(() => undefined);

    navigator.serviceWorker.getRegistration()
      .then(reg => {
        if (reg) checkRegistration(reg);
      })
      .catch(() => undefined);

    // Periodically check for updates every 15 minutes
    const interval = setInterval(() => {
      if (registrationRef.current) {
        void registrationRef.current.update().catch(() => undefined);
      }
    }, 15 * 60 * 1000);

    // Also check for updates when the user returns to the app / refocuses window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registrationRef.current) {
        void registrationRef.current.update().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    setIsUpdating(true);
    const reg = registrationRef.current;
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else if (reg?.installing) {
      reg.installing.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback reload if worker reference is missing
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    hasUpdate: hasUpdate && !dismissed,
    isUpdating,
    applyUpdate,
    dismissUpdate,
  };
}
