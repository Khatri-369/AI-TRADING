import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { NewsArticle } from '../../shared/types';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { useResearchStore } from './useResearchStore';

const articleSchema = z.object({
  id: z.string().max(500), headline: z.string().max(1000), source: z.string().max(200),
  url: z.string().max(3000), publishedAt: z.string().refine(v => Number.isFinite(Date.parse(v))),
  summary: z.string().max(2000), relatedAssets: z.array(z.string().max(30)).max(100),
});
const librarySchema = z.object({
  bookmarks: z.array(articleSchema).max(100),
  readIds: z.array(z.string().max(500)).max(300),
  recentSymbols: z.array(z.string().refine(s => ASSET_BY_SYMBOL.has(s))).max(5),
  briefHidden: z.boolean(),
});
type Library = z.infer<typeof librarySchema>;
const empty: Library = { bookmarks: [], readIds: [], recentSymbols: [], briefHidden: false };
const cache = new Map<string, { raw: string | null; value: Library }>();
const changed = 'tradexa-reading-library';

function read(key: string): Library {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* Reading stays usable without storage. */ }
  const previous = cache.get(key);
  if (previous?.raw === raw) return previous.value;
  let value = empty;
  try { const parsed = librarySchema.safeParse(JSON.parse(raw ?? 'null')); if (parsed.success) value = parsed.data; } catch { /* Ignore invalid local data. */ }
  cache.set(key, { raw, value });
  return value;
}

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(changed, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(changed, listener); };
}

/** Reading history is local and separated by signed-in account; it is never imported into another account. */
export function useReadingLibrary() {
  const { user, sessionReady } = useResearchStore();
  const key = `tradexa.reading.v1.${user ? `account-${user.id}` : 'guest'}`;
  const snapshot = useCallback(() => sessionReady ? read(key) : empty, [key, sessionReady]);
  const library = useSyncExternalStore(subscribe, snapshot);
  const update = useCallback((mutate: (current: Library) => Library) => {
    if (!sessionReady) throw new Error('Wait for account status or reconnect before saving your reading list.');
    const next = librarySchema.parse(mutate(read(key)));
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { throw new Error('Browser storage is unavailable or full. Your change was not saved.'); }
    window.dispatchEvent(new Event(changed));
  }, [key, sessionReady]);
  const remember = useCallback((symbol: string) => {
    if (!sessionReady || !ASSET_BY_SYMBOL.has(symbol) || read(key).recentSymbols[0] === symbol) return;
    update(current => ({ ...current, recentSymbols: [symbol, ...current.recentSymbols.filter(s => s !== symbol)].slice(0, 5) }));
  }, [key, update, sessionReady]);
  const toggleBookmark = (article: NewsArticle) => update(current => {
    if (current.bookmarks.some(a => a.id === article.id)) return { ...current, bookmarks: current.bookmarks.filter(a => a.id !== article.id) };
    if (current.bookmarks.length >= 100) throw new Error('Your reading list has 100 stories. Remove one before saving another.');
    return { ...current, bookmarks: [{ ...article, headline: article.headline.slice(0, 1000), summary: article.summary.slice(0, 2000) }, ...current.bookmarks] };
  });
  return {
    ...library, remember, toggleBookmark,
    markRead: (id: string) => update(current => ({ ...current, readIds: [id, ...current.readIds.filter(value => value !== id)].slice(0, 300) })),
    markUnread: (id: string) => update(current => ({ ...current, readIds: current.readIds.filter(value => value !== id) })),
    clearHistory: () => update(current => ({ ...current, readIds: [], recentSymbols: [] })),
    setBriefHidden: (briefHidden: boolean) => update(current => ({ ...current, briefHidden })),
  };
}
