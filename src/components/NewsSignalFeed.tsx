import { useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useReadingLibrary } from '../hooks/useReadingLibrary';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { ExternalLink, RefreshCw, Bookmark, Check, Share2, SlidersHorizontal } from 'lucide-react';
import type { AnalysisEntry, Engine, NewsArticle, NewsResponse } from '../types/market';
import { analysisKey } from '../hooks/useAIAnalysis';
import { safeArticleUrl } from '../services/api';
import { formatTime } from '../utils/format';
import { Empty, ErrorNotice, Loading } from './Feedback';
import AnalysisResult from './AnalysisResult';
import StatusBadge from './StatusBadge';

interface Props {
  initialView?: 'all' | 'saved';
  onOpenAsset: (symbol: string) => void;
  data: NewsResponse | null;
  loading: boolean;
  error: string | null;
  search: string;
  engine: Engine;
  onEngine: (engine: Engine) => void;
  entries: Record<string, AnalysisEntry>;
  onAnalyze: (article: NewsArticle) => void;
  onRefresh: () => void;
}

export default function NewsSignalFeed({
  initialView = 'all',
  onOpenAsset,
  data,
  loading,
  error,
  search,
  engine,
  onEngine,
  entries,
  onAnalyze,
  onRefresh,
}: Props) {
  const [view, setView] = useState<'all' | 'watchlist' | 'saved'>(initialView);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [message, setMessage] = useState('');
  const { symbols } = useWatchlist();
  const library = useReadingLibrary();
  const watchlistOnly = view === 'watchlist';
  const articles = (view === 'saved' ? library.bookmarks : data?.articles ?? []).filter(article =>
    (!watchlistOnly || article.relatedAssets.some(symbol => symbols.includes(symbol))) &&
    (!unreadOnly || !library.readIds.includes(article.id)) &&
    `${article.headline} ${article.summary} ${article.source} ${article.relatedAssets.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const act = (action: () => void, success = '') => {
    try { action(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your change.'); }
  };
  async function share(article: NewsArticle) {
    const url = safeArticleUrl(article.url);
    if (!url) return;
    try {
      if (navigator.share) await navigator.share({ title: article.headline, url });
      else { await navigator.clipboard.writeText(url); setMessage('Article link copied.'); }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessage('Sharing is unavailable here. Open the headline to copy its link from your browser.');
    }
  }

  return (
    <section aria-label="Market news">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><h1 className="text-[28px] font-semibold tracking-tight">News</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">Headlines for the markets you follow.</p></div>
        <button className="icon-button min-h-11 min-w-11" disabled={loading} onClick={onRefresh} aria-label="Refresh news headlines"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex flex-wrap gap-1" aria-label="News filters">{(['all', 'watchlist', 'saved'] as const).map(value => <button key={value} onClick={() => { setView(value); setVisibleCount(12); }} aria-pressed={view === value} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${view === value ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`}>{value === 'all' ? 'All news' : value === 'watchlist' ? 'My watchlist' : `Saved (${library.bookmarks.length})`}</button>)}</div>
        <details><summary aria-label="Analysis settings" className="icon-button cursor-pointer min-h-11 min-w-11 list-none"><SlidersHorizontal size={18} /><span className="sr-only">Analysis settings</span></summary><div className="absolute top-full right-0 z-10 w-56 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-lg"><label className="text-xs">Analysis model<select className="field mt-2 min-h-11" value={engine} onChange={e => onEngine(e.target.value as Engine)}><option value="gemini">Gemini</option><option value="finbert">FinBERT</option></select></label><p className="mt-2 text-xs text-[var(--text-secondary)]">Analysis runs only when you request it and may be unavailable.</p><button className="mt-2 min-h-11 text-xs underline" onClick={() => act(library.clearHistory, 'Reading history cleared. Saved stories were kept.')}>Clear reading history</button></div></details>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setVisibleCount(12); }} />Unread only</label>
        <span>{view === 'saved' ? 'Reading list · saved in this browser' : `${articles.length} matching headlines`}</span>
      </div>
      {message && <p role="status" className="mb-4 rounded-lg border border-[var(--border-default)] p-3 text-sm">{message}</p>}
      {data && view !== 'saved' && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <StatusBadge status={error ? 'stale' : data.status} cached={data.cached} />
          <span>{data.provider}</span>
          <span>·</span>
          <span>Updated {formatTime(data.fetchedAt)}</span>
        </div>
      )}

      {view !== 'saved' && (error || data?.error) && (
        <div className="mb-4">
          <ErrorNotice message={error ?? data?.error ?? ''} onRetry={onRefresh} />
        </div>
      )}

      {loading && !data && view !== 'saved' ? (
        <Loading label="Loading market headlines…" />
      ) : !articles.length ? (
        <Empty
          title={search ? 'No matching news articles' : unreadOnly ? 'No unread stories in this view' : view === 'saved' ? 'Your reading list starts here' : watchlistOnly ? 'No headlines for your watchlist' : search ? 'No matching news articles' : 'No news articles available'}
          detail={
            search ? `No headlines matched "${search}". Try another search or switch views.` : unreadOnly ? 'You have caught up with these headlines. Turn off Unread only to see them again.' : view === 'saved' ? 'Save a headline to keep it here after it leaves the news feed. Saved stories stay in this browser.' : watchlistOnly ? (symbols.length ? 'No matching stories right now. Try All news for wider market coverage.' : 'Save stocks using the stars on your watchlist to see related headlines here.') : search
              ? `No headlines matched "${search}". Try searching for another asset or keyword.`
              : 'The provider returned no active articles at this time.'
          }
        />
      ) : (
        <div className="space-y-3">
          {articles.slice(0, visibleCount).map((article) => {
            const entry = entries[analysisKey(`news:${article.id}`, engine)];
            const url = safeArticleUrl(article.url);
            const saved = library.bookmarks.some(a => a.id === article.id);
            const read = library.readIds.includes(article.id);
            return (
              <article
                key={article.id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition hover:border-[var(--border-default)]"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-secondary)]">{article.source}{read && <span className="ml-2 font-normal">· Read</span>}</span>
                  <time dateTime={article.publishedAt} className="text-[11px]">
                    {formatTime(article.publishedAt)}
                  </time>
                </div>

                <h3 className="text-base font-semibold leading-snug text-[var(--text-primary)]">
                  {url ? (
                    <a
                      href={url}
                      onClick={() => act(() => library.markRead(article.id))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-baseline gap-1 hover:text-[var(--accent-text)] transition"
                    >
                      <span>{article.headline}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-text)]" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    article.headline
                  )}
                </h3>

                {article.summary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                    {article.summary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {article.relatedAssets.length > 0 ? (
                      article.relatedAssets.map((symbol, idx) => ASSET_BY_SYMBOL.has(symbol) ? (
                        <button key={`${symbol}-${idx}`} className="min-h-11 rounded-md bg-[var(--bg-subtle)] px-2 text-xs text-[var(--accent-text)]" aria-label={`Open ${symbol} from headline`} onClick={() => onOpenAsset(symbol)}>{symbol}<ExternalLink size={12} className="ml-1 inline" /></button>
                      ) : <span key={`${symbol}-${idx}`} className="text-xs text-[var(--text-secondary)]">{symbol}</span>)
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">Macro / General</span>
                    )}
                  </div>

                  <button
                    className="button-secondary min-h-11 text-xs px-3"
                    disabled={entry?.loading}
                    onClick={() => onAnalyze(article)}
                  >
                    {entry?.loading ? 'Analyzing…' : 'Analyze headline'}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="button-secondary min-h-11" aria-label={`${saved ? 'Unsave' : 'Save'} story: ${article.headline}`} aria-pressed={saved} onClick={() => act(() => library.toggleBookmark(article), saved ? 'Story removed from your reading list.' : 'Story saved for later.')}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</button>
                  <button className="button-secondary min-h-11" onClick={() => act(() => read ? library.markUnread(article.id) : library.markRead(article.id))}><Check size={16} />{read ? 'Mark unread' : 'Mark read'}</button>
                  {url && <button className="icon-button min-h-11 min-w-11" aria-label={`Share story: ${article.headline}`} onClick={() => void share(article)}><Share2 size={16} /></button>}
                </div>

                {entry && (
                  <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                    {entry.loading && <Loading label="Running AI sentiment analysis…" />}
                    {entry.error && <ErrorNotice message={entry.error} />}
                    {entry.result && <AnalysisResult result={entry.result} />}
                  </div>
                )}
              </article>
            );
          })}
          <div className="py-4 text-center">{articles.length > visibleCount ? <button className="button-secondary min-h-11" onClick={() => setVisibleCount(count => count + 12)}>Show more headlines</button> : <p className="text-sm text-[var(--text-secondary)]">You’re through the {articles.length} {articles.length === 1 ? 'story' : 'stories'} in this view.</p>}</div>
        </div>
      )}
    </section>
  );
}
