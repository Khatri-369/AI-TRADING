import { useState, useMemo } from 'react';
import {
  ExternalLink,
  Newspaper,
  RefreshCw,
  Bookmark,
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
  BarChart2,
  HelpCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { AnalysisEntry, Engine, NewsArticle, NewsResponse, Quote } from '../types/market';
import { analysisKey } from '../hooks/useAIAnalysis';
import { safeArticleUrl } from '../services/api';
import { formatTime, formatPercent } from '../utils/format';
import { Empty, ErrorNotice, Loading } from './Feedback';
import AnalysisResult from './AnalysisResult';
import StatusBadge from './StatusBadge';
import { useWatchlist } from '../hooks/useWatchlist';
import { useRouter } from '../utils/router';
import AssetIcon from './AssetIcon';

interface Props {
  data: NewsResponse | null;
  quotes?: Quote[];
  loading: boolean;
  error: string | null;
  search: string;
  engine: Engine;
  onEngine: (engine: Engine) => void;
  entries: Record<string, AnalysisEntry>;
  onAnalyze: (article: NewsArticle) => void;
  onRefresh: () => void;
}

const STORAGE_SAVED_NEWS = 'markets.news.saved.v1';
const STORAGE_READ_NEWS = 'markets.news.read.v1';

// Text similarity helper for deduplication/grouping
function textTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['with', 'from', 'that', 'this', 'after', 'about', 'market', 'stock', 'share'].includes(w))
  );
}

function computeOverlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const token of a) {
    if (b.has(token)) matches++;
  }
  return matches / Math.min(a.size, b.size);
}

interface ClusteredArticle extends NewsArticle {
  duplicateSources?: Array<{ source: string; url: string; headline: string }>;
}

export default function NewsSignalFeed({
  data,
  quotes = [],
  loading,
  error,
  search,
  engine,
  onEngine,
  entries,
  onAnalyze,
  onRefresh,
}: Props) {
  const [, navigate] = useRouter();
  const { symbols: watchlistSymbols } = useWatchlist();
  const quotesMap = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const q of quotes) {
      if (q?.symbol) map.set(q.symbol.toUpperCase(), q);
    }
    return map;
  }, [quotes]);
  const [feedFilter, setFeedFilter] = useState<'all' | 'watchlist' | 'saved'>('all');
  const [region, setRegion] = useState<'all' | 'india' | 'global'>('all');
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [shareToast, setShareToast] = useState('');

  // Persisted saved bookmarks
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SAVED_NEWS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persisted read state
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_READ_NEWS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = savedIds.includes(id) ? savedIds.filter((item) => item !== id) : [...savedIds, id];
    setSavedIds(next);
    try {
      localStorage.setItem(STORAGE_SAVED_NEWS, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const markRead = (id: string) => {
    if (readIds.includes(id)) return;
    const next = [...readIds.slice(-200), id];
    setReadIds(next);
    try {
      localStorage.setItem(STORAGE_READ_NEWS, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleShare = async (article: NewsArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: article.headline,
      text: `${article.headline} (${article.source})`,
      url: article.url || window.location.href,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    // Fallback: clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${article.headline}\n${article.url ?? ''}`);
        setShareToast('Link copied to clipboard');
        setTimeout(() => setShareToast(''), 3000);
      } catch {
        // Ignore
      }
    }
  };

  // Group duplicate coverage of the same event
  const clusteredArticles = useMemo(() => {
    const rawArticles = data?.articles ?? [];
    const clusters: ClusteredArticle[] = [];

    for (const article of rawArticles) {
      const tokens = textTokens(article.headline);
      let matchedCluster: ClusteredArticle | undefined;

      for (const existing of clusters) {
        const existingTokens = textTokens(existing.headline);
        const overlap = computeOverlap(tokens, existingTokens);
        // If similarity is high, cluster duplicate sources
        if (overlap >= 0.55) {
          matchedCluster = existing;
          break;
        }
      }

      if (matchedCluster) {
        matchedCluster.duplicateSources = matchedCluster.duplicateSources ?? [];
        if (!matchedCluster.duplicateSources.some((s) => s.source === article.source)) {
          matchedCluster.duplicateSources.push({
            source: article.source,
            url: article.url,
            headline: article.headline,
          });
        }
      } else {
        clusters.push({ ...article, duplicateSources: [] });
      }
    }

    return clusters;
  }, [data?.articles]);

  // Apply search and tab filters
  const filteredArticles = clusteredArticles.filter((article) => {
    if (region !== 'all' && article.region !== region) return false;
    // Search query match
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      `${article.headline} ${article.summary ?? ''} ${article.source} ${article.relatedAssets.join(' ')}`
        .toLowerCase()
        .includes(query);

    if (!matchesSearch) return false;

    if (feedFilter === 'saved') {
      return savedIds.includes(article.id);
    }

    if (feedFilter === 'watchlist') {
      if (!watchlistSymbols.length) return false;
      return article.relatedAssets.some((sym) => watchlistSymbols.includes(sym));
    }

    return true;
  });

  return (
    <section className="panel space-y-4" aria-label="Financial News and Sentiment Analysis">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
        <div>
          <h2 className="section-heading text-base font-bold text-[var(--text-primary)]">
            <Newspaper className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>Financial News & Sentiment</span>
            {data && (
              <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                ({filteredArticles.length} stories)
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Multi-source financial news grouped by event, with grounded market context.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span>Model:</span>
            <select
              className="field h-8 py-1 text-xs"
              value={engine}
              onChange={(e) => onEngine(e.target.value as Engine)}
            >
              <option value="gemini">Gemini LLM</option>
              <option value="finbert">FinBERT (NLP)</option>
            </select>
          </label>

          <button
            type="button"
            className="button-secondary h-8 text-xs min-h-[36px]"
            disabled={loading}
            onClick={onRefresh}
            title="Refresh news headlines"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Scope Segment Tabs: All / Watchlist / Saved */}
      {data?.error && <p role="status" className="text-xs text-[var(--text-muted)]">Coverage notice: {data.error}</p>}
      <label className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">News region
        <select aria-label="News region" className="field min-h-[44px]" value={region} onChange={event => setRegion(event.target.value as typeof region)}>
          <option value="all">Global + India</option><option value="india">India</option><option value="global">Global</option>
        </select>
        <span>Related stocks are provider links or company mentions—not confirmed price effects.</span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={feedFilter === 'all'}
            onClick={() => setFeedFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition min-h-[36px] ${
              feedFilter === 'all'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Market News
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={feedFilter === 'watchlist'}
            onClick={() => setFeedFilter('watchlist')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition min-h-[36px] ${
              feedFilter === 'watchlist'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            My Watchlist ({watchlistSymbols.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={feedFilter === 'saved'}
            onClick={() => setFeedFilter('saved')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition min-h-[36px] flex items-center gap-1 ${
              feedFilter === 'saved'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark size={12} />
            <span>Saved ({savedIds.length})</span>
          </button>
        </div>

        {data && (
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <StatusBadge status={error ? 'stale' : data.status} cached={data.cached} />
            <span>{data.provider}</span>
            <span>·</span>
            <span>{formatTime(data.fetchedAt)}</span>
          </div>
        )}
      </div>

      {(error || data?.error) && (
        <div>
          <ErrorNotice message={error ?? data?.error ?? ''} onRetry={onRefresh} />
        </div>
      )}

      {loading && !data ? (
        <Loading label="Loading verified market headlines…" />
      ) : !filteredArticles.length ? (
        <Empty
          title={
            feedFilter === 'saved'
              ? 'No saved articles'
              : feedFilter === 'watchlist'
              ? 'No stories matching your watchlist'
              : search
              ? 'No matching headlines'
              : 'No articles currently available'
          }
          detail={
            feedFilter === 'saved'
              ? 'Bookmark articles with the bookmark icon to read or review them later.'
              : feedFilter === 'watchlist'
              ? watchlistSymbols.length === 0
                ? 'Add stocks to your watchlist to see targeted headlines here.'
                : 'None of your watchlist instruments were mentioned in the current news feed.'
              : 'Try checking your search term or refreshing the feed.'
          }
        />
      ) : (
        <div className="space-y-3.5">
          {filteredArticles.map((article) => {
            const entry = entries[analysisKey(`news:${article.id}`, engine)];
            const url = safeArticleUrl(article.url);
            const isSaved = savedIds.includes(article.id);
            const isRead = readIds.includes(article.id);
            const isWhyOpen = Boolean(expandedWhy[article.id]);

            return (
              <article
                key={article.id}
                onClick={() => markRead(article.id)}
                className={`rounded-xl border p-4 transition ${
                  isRead
                    ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-95'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xs'
                }`}
              >
                {/* Meta row: Source, Time, Actions */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--accent-text)]">{article.source}</span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <time dateTime={article.publishedAt} className="text-[11px] text-[var(--text-muted)]">
                      {formatTime(article.publishedAt)}
                    </time>
                    {isRead && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        (Read)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Bookmark Save Action */}
                    <button
                      type="button"
                      onClick={(e) => toggleSave(article.id, e)}
                      aria-label={isSaved ? 'Remove bookmark' : 'Save article'}
                      title={isSaved ? 'Remove bookmark' : 'Save article'}
                      className="icon-button min-h-[36px] min-w-[36px] p-1.5"
                    >
                      <Bookmark
                        size={15}
                        className={isSaved ? 'fill-amber-400 text-amber-400' : 'text-[var(--text-muted)]'}
                      />
                    </button>

                    {/* Share Action */}
                    <button
                      type="button"
                      onClick={(e) => void handleShare(article, e)}
                      aria-label="Share article"
                      title="Share article"
                      className="icon-button min-h-[36px] min-w-[36px] p-1.5"
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Headline */}
                <h3 className="text-sm sm:text-base font-semibold leading-snug text-[var(--text-primary)]">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-baseline gap-1 hover:text-[var(--accent-text)] transition"
                    >
                      <span>{article.headline}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-text)]" />
                    </a>
                  ) : (
                    article.headline
                  )}
                </h3>

                {/* Summary */}
                {article.summary && (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {article.summary}
                  </p>
                )}

                {/* Duplicate Coverage / Other Sources */}
                {article.duplicateSources && article.duplicateSources.length > 0 && (
                  <div className="mt-2.5 rounded-lg bg-[var(--bg-subtle)] p-2 text-xs border border-[var(--border-subtle)]">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                      Also reported by:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {article.duplicateSources.map((dup, idx) => {
                        const dupUrl = safeArticleUrl(dup.url);
                        return dupUrl ? (
                          <a
                            key={idx}
                            href={dupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-text)] underline hover:text-[var(--accent-hover)]"
                          >
                            <span>{dup.source}</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span key={idx} className="text-[11px] text-[var(--text-secondary)]">
                            {dup.source}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer: Related Instrument Chips with Direct Chart Links & Why this matters */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {article.relatedAssets.length > 0 ? (
                      article.relatedAssets.map((sym) => {
                        const q = quotesMap.get(sym.toUpperCase());
                        const hasChange = q?.changePercent !== null && q?.changePercent !== undefined;
                        const isGain = (q?.changePercent ?? 0) >= 0;
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => {
                              localStorage.setItem('last_chart_symbol', sym);
                              navigate(`/desk?symbol=${encodeURIComponent(sym)}`);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-medium transition min-h-[32px] cursor-pointer ${
                              hasChange
                                ? isGain
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)]'
                            }`}
                            title={`${article.stockLinks?.find(link => link.symbol === sym)?.evidence ?? 'Linked by news provider'}. Open ${sym} chart.`}
                          >
                            <AssetIcon symbol={sym} size="xs" />
                            <span className="font-bold">{sym}</span>
                            {hasChange && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold">
                                {isGain ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                {formatPercent(q.changePercent)}
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">Macro context</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* "Why this may matter" Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWhy((prev) => ({ ...prev, [article.id]: !prev[article.id] }))
                      }
                      className="button-secondary text-[11px] min-h-[32px] flex items-center gap-1"
                    >
                      <HelpCircle size={12} />
                      <span>Why this matters</span>
                      {isWhyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {/* AI Sentiment trigger */}
                    <button
                      type="button"
                      className="button-secondary text-[11px] min-h-[32px]"
                      disabled={entry?.loading}
                      onClick={() => onAnalyze(article)}
                    >
                      {entry?.loading ? 'Analyzing…' : `AI Analysis`}
                    </button>
                  </div>
                </div>

                {/* Expandable "Why this may matter" Section */}
                {isWhyOpen && (
                  <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-xs space-y-2 animate-in fade-in duration-150">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                      <span>Market Evidence & Analytical Context</span>
                    </h4>

                    <div className="grid gap-2 sm:grid-cols-3 pt-1 text-[11px] leading-relaxed">
                      <div className="space-y-1">
                        <strong className="text-[var(--text-primary)] block">Reported Evidence:</strong>
                        <p className="text-[var(--text-secondary)]">
                          {article.summary || article.headline}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <strong className="text-[var(--text-primary)] block">Sector Transmission:</strong>
                        <p className="text-[var(--text-secondary)]">
                          {article.relatedAssets.length
                            ? `Potential relevance to ${article.relatedAssets.join(', ')} operational drivers, sentiment, or supply chain dynamics.`
                            : 'Broader macro transmission mechanism impacting interest rate expectations or liquidity.'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <strong className="text-amber-500 block">Uncertainty & Reality:</strong>
                        <p className="text-[var(--text-muted)]">
                          News sentiment does not guarantee price direction. Execution realities, prevailing trends, and broader market conditions often override individual headlines.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Sentiment Analysis Card */}
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
        </div>
      )}

      {/* Toast Notification */}
      {shareToast && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] px-3 py-2 text-xs font-medium shadow-lg text-[var(--text-primary)]"
        >
          <Check size={14} className="text-emerald-500" />
          <span>{shareToast}</span>
        </div>
      )}
    </section>
  );
}
