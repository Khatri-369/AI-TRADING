import { useState } from 'react';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { recordSchemas } from '../../shared/research';
import { useResearchStore } from './useResearchStore';

export function useWatchlist() {
  const store = useResearchStore();
  const [legacy] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem('markets.watchlist.v1') ?? '[]'); return Array.isArray(value) ? value.filter(s => typeof s === 'string' && ASSET_BY_SYMBOL.has(s)) : []; } catch { return []; }
  });
  const record = store.records.find(r => r.id === 'user-watchlist' && r.kind === 'watchlist');
  const parsed = recordSchemas.watchlist.safeParse(record?.data);
  return { store, record, symbols: parsed.success ? parsed.data.symbols : store.user ? [] : legacy };
}
