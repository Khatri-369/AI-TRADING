import { useEffect, useMemo, useState } from 'react';
import { getOverview, getNews } from '../services/api';
import { usePolling } from './usePolling';
import type { Quote } from '../types/market';

export interface LiveTickUpdate {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  timestamp: string;
  provider: 'binance' | 'finnhub';
}

export function useMarketData() {
  const state = usePolling(getOverview, 60_000);
  const [liveTicks, setLiveTicks] = useState<Record<string, LiveTickUpdate>>({});

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    function connect() {
      try {
        es = new EventSource('/api/stream/live-ticks');

        es.addEventListener('snapshot', (e: MessageEvent) => {
          try {
            const list: LiveTickUpdate[] = JSON.parse(e.data);
            const map: Record<string, LiveTickUpdate> = {};
            for (const item of list) {
              map[item.symbol] = item;
            }
            setLiveTicks(prev => ({ ...prev, ...map }));
          } catch {}
        });

        es.onmessage = (e: MessageEvent) => {
          try {
            const tick: LiveTickUpdate = JSON.parse(e.data);
            if (tick && tick.symbol) {
              setLiveTicks(prev => ({ ...prev, [tick.symbol]: tick }));
            }
          } catch {}
        };

        es.onerror = () => {
          es?.close();
          es = null;
          retryTimeout = setTimeout(connect, 5000);
        };
      } catch {}
    }

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);

  const quotes: Quote[] = useMemo(() => {
    return (state.data?.quotes ?? []).map(quote => {
      const live = liveTicks[quote.symbol];
      if (!live) {
        return state.error && quote.price !== null
          ? { ...quote, status: 'stale' as const, cached: true, error: state.error }
          : quote;
      }

      return {
        ...quote,
        price: live.price,
        change: live.change !== undefined ? live.change : quote.change,
        changePercent: live.changePercent !== undefined ? live.changePercent : quote.changePercent,
        volume: live.volume !== undefined ? live.volume : quote.volume,
        asOf: live.timestamp,
        status: 'live' as const,
        cached: false,
      };
    });
  }, [state.data, state.error, liveTicks]);

  return { ...state, quotes, liveCount: Object.keys(liveTicks).length };
}

export const useNews = () => usePolling(getNews, 300_000);
