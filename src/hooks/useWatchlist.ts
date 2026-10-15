import { useState, useCallback } from 'react';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { recordSchemas } from '../../shared/research';
import { useResearchStore } from './useResearchStore';

const STORAGE_KEY = 'markets.watchlist.v1';

export function useWatchlist() {
  const store = useResearchStore();
  const [legacy, setLegacy] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && ASSET_BY_SYMBOL.has(s)) : [];
    } catch {
      return [];
    }
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const watchlistRecord = store.records.find((r) => r.id === 'user-watchlist' && r.kind === 'watchlist');
  const recordVersion = watchlistRecord?.version ?? 0;
  const parsed = recordSchemas.watchlist.safeParse(watchlistRecord?.data);
  const symbols = parsed.success ? parsed.data.symbols : store.user ? [] : legacy;

  const toggle = useCallback(
    async (symbol: string) => {
      if (saving) return;
      setSaving(true);
      setError('');
      const next = symbols.includes(symbol)
        ? symbols.filter((s) => s !== symbol)
        : [...symbols, symbol];

      try {
        // Always mirror to localStorage for reliable offline/guest resilience
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setLegacy(next);

        // Save to workspace store (handles account sync or guest local store)
        await store.save('user-watchlist', 'watchlist', { symbols: next }, recordVersion);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Watchlist could not be updated.');
      } finally {
        setSaving(false);
      }
    },
    [symbols, saving, store, recordVersion]
  );

  const saveSymbols = useCallback(
    async (nextSymbols: string[]) => {
      if (saving) return;
      setSaving(true);
      setError('');
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSymbols));
        setLegacy(nextSymbols);
        await store.save('user-watchlist', 'watchlist', { symbols: nextSymbols }, recordVersion);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Watchlist could not be saved.');
      } finally {
        setSaving(false);
      }
    },
    [saving, store, recordVersion]
  );

  return {
    symbols,
    isSaved: (symbol: string) => symbols.includes(symbol),
    toggle,
    saveSymbols,
    saving,
    error,
    storeStatus: store.status,
    user: store.user,
  };
}
