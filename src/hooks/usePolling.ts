import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api';

/** Recursive timeouts start after completion; hidden pages cancel work and resume on focus. */
export function usePolling<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(document.hidden);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(Math.round(intervalMs / 1000));
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (!active || document.hidden || (controller && !controller.signal.aborted)) return;
      clearTimeout(timer);
      const current = new AbortController();
      controller = current;
      setLoading(true);
      try {
        const result = await load(current.signal);
        if (active && !current.signal.aborted) {
          setData(result);
          setError(null);
          setLastFetched(new Date());
          setSecondsUntilRefresh(Math.round(intervalMs / 1000));
        }
      } catch (cause) {
        if (active && !current.signal.aborted) {
          setError(errorMessage(cause));
        }
      } finally {
        if (active && controller === current) {
          controller = null;
          setLoading(false);
          if (!document.hidden && intervalMs > 0) {
            timer = setTimeout(() => void run(), intervalMs);
          }
        }
      }
    };

    const visibility = () => {
      setPaused(document.hidden);
      if (document.hidden) {
        clearTimeout(timer);
        controller?.abort();
        setLoading(false);
      } else {
        void run();
      }
    };

    refreshRef.current = () => void run();
    const online = () => { void run(); };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visibility);
    void run();

    return () => {
      active = false;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', online);
      refreshRef.current = () => {};
    };
  }, [load, intervalMs, enabled]);

  // Live countdown timer ticking down every second
  useEffect(() => {
    if (paused || loading || intervalMs <= 0) return;
    const interval = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, loading, intervalMs]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, loading, error, refresh, paused, lastFetched, secondsUntilRefresh };
}
