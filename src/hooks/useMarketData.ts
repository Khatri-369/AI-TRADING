import { useEffect, useMemo, useState } from 'react';
import { getOverview, getNews, quoteSchema } from '../services/api';
import { usePolling } from './usePolling';
import type { Quote } from '../types/market';

export function useMarketData() {
  const state = usePolling(getOverview, 60_000);
  const [ticks, setTicks] = useState<Record<string, Quote>>({});
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let source: EventSource | null = null;
    const connect = () => {
      source?.close();
      source = null;
      setConnected(false);
      if (document.hidden) return;
      source = new EventSource('/api/stream/live-ticks');
      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false); // Native EventSource handles reconnection.
      source.onmessage = (event) => {
        try {
          const parsed = quoteSchema.safeParse(JSON.parse(event.data));
          if (parsed.success) {
            setTicks((previous) => ({ ...previous, [parsed.data.symbol]: parsed.data }));
          }
        } catch {
          /* Ignore malformed updates. */
        }
      };
    };
    connect();
    document.addEventListener('visibilitychange', connect);
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      source?.close();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', connect);
    };
  }, []);

  const quotes = useMemo(() => (state.data?.quotes ?? []).map((rest) => {
    const tick = ticks[rest.symbol];
    let quote = tick && Date.parse(tick.asOf!) >= Date.parse(rest.asOf ?? '1970-01-01') && Date.parse(tick.fetchedAt!) >= Date.parse(rest.fetchedAt ?? '1970-01-01')
      ? { ...tick, volume: rest.volume, session: rest.session }
      : rest;
    const age = quote.asOf ? now - Date.parse(quote.asOf) : Infinity;
    const expired = quote.session.state === 'OPEN' && quote.category !== 'forex' && age > 15 * 60_000;
    if (quote.price !== null && (state.error || expired || (quote !== rest && !connected))) {
      quote = { ...quote, status: 'stale', cached: true, ...(state.error ? { error: state.error } : {}) };
    }
    return quote;
  }), [state.data, state.error, ticks, connected, now]);

  return {
    ...state,
    quotes,
    liveCount: quotes.filter((q) => q.status === 'live').length,
    connected,
  };
}

export const useNews = () => usePolling(getNews, 300_000);
