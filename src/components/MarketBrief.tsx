import { ArrowUpRight, Bell, Bookmark, Clock3, X } from 'lucide-react';
import { useState } from 'react';
import type { NewsResponse, Quote } from '../../shared/types';
import { useReadingLibrary } from '../hooks/useReadingLibrary';
import { formatTime } from '../utils/format';
import { safeArticleUrl } from '../services/api';

interface Props {
  quotes: Quote[];
  symbols: string[];
  news: NewsResponse | null;
  newsLoading: boolean;
  newsError: string | null;
  onOpen: (path: string) => void;
}

export default function MarketBrief({ quotes, symbols, news, newsLoading, newsError, onOpen }: Props) {
  const library = useReadingLibrary();
  const [message, setMessage] = useState('');
  const act = (action: () => void) => { try { action(); setMessage(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this change.'); } };
  const relevant = (news?.articles ?? []).filter(a => !symbols.length || a.relatedAssets.some(s => symbols.includes(s)))
    .slice().sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const stories = relevant.slice(0, 3);
  const unread = relevant.filter(a => !library.readIds.includes(a.id)).length;
  const equities = quotes.filter(q => symbols.includes(q.symbol) && ['india', 'us'].includes(q.category)
    && q.changePercent !== null && q.price !== null && q.asOf && !['stale', 'unavailable'].includes(q.status));
  const mover = equities.sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!))[0];

  return <div className="space-y-5">
    {library.recentSymbols.length > 0 && <section aria-label="Recent charts" className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Continue researching</h2><button className="min-h-11 text-xs text-[var(--text-secondary)] hover:underline" onClick={() => act(library.clearHistory)}>Clear reading history</button></div>
      <div className="flex flex-wrap gap-2">{library.recentSymbols.map(symbol => <button key={symbol} className="button-secondary min-h-11" onClick={() => onOpen(`/asset/${encodeURIComponent(symbol)}`)}><Clock3 size={15} />{symbol}<ArrowUpRight size={14} /></button>)}</div>
    </section>}
    {library.briefHidden ? <button className="button-secondary min-h-11" onClick={() => act(() => library.setBriefHidden(false))}>Show my market brief</button> : <section id="market-brief" aria-labelledby="brief-heading" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] p-4 sm:p-5">
        <div><p className="text-xs text-[var(--text-secondary)]">{symbols.length ? 'Based on your watchlist' : 'Start exploring'}</p><h2 id="brief-heading" className="mt-1 text-xl font-semibold tracking-tight">Your market brief</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{unread ? `${unread} unread ${unread === 1 ? 'story' : 'stories'} in this feed` : 'A quick catch-up, at your pace.'}</p></div>
        <button aria-label="Hide market brief" className="icon-button min-h-11 min-w-11 !border-transparent" onClick={() => act(() => library.setBriefHidden(true))}><X size={17} /></button>
      </header>
      {mover && <button className="block w-full border-b border-[var(--border-subtle)] p-4 sm:px-5 text-left hover:bg-[var(--bg-surface-hover)]" onClick={() => onOpen(`/asset/${encodeURIComponent(mover.symbol)}`)}>
        <span className="block text-xs text-[var(--text-secondary)]">Largest reported equity move in your list</span>
        <span className="mt-1 flex items-center justify-between gap-3"><span className="font-semibold">{mover.symbol}</span><span className={mover.changePercent! >= 0 ? 'text-[var(--gain-text)]' : 'text-[var(--loss-text)]'}>{mover.changePercent! > 0 ? '+' : ''}{mover.changePercent!.toFixed(2)}% <ArrowUpRight size={15} className="inline" /></span></span>
        <span className="mt-1 block text-xs text-[var(--text-secondary)]">vs previous close · {mover.provider} · {mover.status}{mover.cached ? ' · cached' : ''} · {formatTime(mover.asOf)}</span>
      </button>}
      {news && <p className="px-4 pt-4 text-xs text-[var(--text-secondary)]">{news.provider} · {news.status}{news.cached ? ' · cached' : ''} · Updated {formatTime(news.fetchedAt)}</p>}
      {(newsError || news?.error) && <p className="px-4 pt-4 text-xs text-[var(--text-secondary)]">News refresh is unavailable. Any displayed headlines may be outdated.</p>}
      {stories.length ? <div className="divide-y divide-[var(--border-subtle)]">{stories.map(article => {
        const url = safeArticleUrl(article.url);
        const saved = library.bookmarks.some(a => a.id === article.id);
        return <article key={article.id} className="p-4 sm:px-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><span>{article.source}</span><span>·</span><span>{library.readIds.includes(article.id) ? 'Read' : 'Unread'}</span></div>
          <h3 className="mt-2 font-medium leading-6">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={() => act(() => library.markRead(article.id))}>{article.headline}<span className="sr-only"> (opens in a new tab)</span></a> : article.headline}</h3>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><time className="text-xs text-[var(--text-secondary)]" dateTime={article.publishedAt}>{formatTime(article.publishedAt)}</time><button className="button-secondary min-h-11" aria-label={`${saved ? 'Unsave' : 'Save'} story: ${article.headline}`} aria-pressed={saved} onClick={() => act(() => library.toggleBookmark(article))}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</button></div>
        </article>;
      })}</div> : <p className="p-5 text-sm text-[var(--text-secondary)]">{newsLoading ? 'Loading your headlines…' : symbols.length ? 'No tagged headlines for your list right now. Explore all news for wider coverage.' : 'Save stocks with the star buttons to personalize this briefing.'}</p>}
      <footer className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] p-4 sm:px-5">
        <button className="button-secondary min-h-11" onClick={() => onOpen('/news')}>Open news <ArrowUpRight size={15} /></button>
        <button className="button-secondary min-h-11" onClick={() => onOpen('/news?view=saved')}><Bookmark size={15} />Reading list ({library.bookmarks.length})</button>
        <button className="button-secondary min-h-11" onClick={() => onOpen('/desk?tab=Alerts')}><Bell size={15} />Manage alerts</button>
      </footer>
    </section>}
    {message && <p role="alert" className="text-sm text-[var(--loss-text)]">{message}</p>}
    <p className="text-xs leading-5 text-[var(--text-secondary)]">Saved stories and reading history stay in this browser. Alerts are optional; set quiet hours in Tools.</p>
  </div>;
}
