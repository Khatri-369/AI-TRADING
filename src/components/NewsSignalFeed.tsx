import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import type { AnalysisEntry, Engine, NewsArticle, NewsResponse } from '../types/market';
import { analysisKey } from '../hooks/useAIAnalysis';
import { safeArticleUrl } from '../services/api';
import { formatTime } from '../utils/format';
import { Empty, ErrorNotice, Loading } from './Feedback';
import AnalysisResult from './AnalysisResult';
import StatusBadge from './StatusBadge';

interface Props {
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
  const articles = (data?.articles ?? []).filter((article) =>
    `${article.headline} ${article.summary} ${article.source} ${article.relatedAssets.join(' ')}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <section className="panel" aria-label="Financial News and Sentiment Analysis">
      {/* Header and Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
        <div>
          <h2 className="section-heading text-base">
            <Newspaper className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>Financial News & Sentiment</span>
            {data && (
              <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                ({articles.length} headlines)
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Verified market news feed with on-demand AI sentiment classification.
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
            className="button-secondary h-8 text-xs"
            disabled={loading}
            onClick={onRefresh}
            title="Refresh news headlines"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {data && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <StatusBadge status={error ? 'stale' : data.status} cached={data.cached} />
          <span>Provider: {data.provider}</span>
          <span>·</span>
          <span>Fetched: {formatTime(data.fetchedAt)}</span>
        </div>
      )}

      {(error || data?.error) && (
        <div className="mb-4">
          <ErrorNotice message={error ?? data?.error ?? ''} onRetry={onRefresh} />
        </div>
      )}

      {loading && !data ? (
        <Loading label="Loading verified market headlines…" />
      ) : !articles.length ? (
        <Empty
          title={search ? 'No matching news articles' : 'No news articles available'}
          detail={
            search
              ? `No headlines matched "${search}". Try searching for another asset or keyword.`
              : 'The provider returned no active articles at this time.'
          }
        />
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const entry = entries[analysisKey(`news:${article.id}`, engine)];
            const url = safeArticleUrl(article.url);
            return (
              <article
                key={article.id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition hover:border-[var(--border-default)]"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--accent-text)]">{article.source}</span>
                  <time dateTime={article.publishedAt} className="text-[11px]">
                    {formatTime(article.publishedAt)}
                  </time>
                </div>

                <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
                  {url ? (
                    <a
                      href={url}
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
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                    {article.summary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {article.relatedAssets.length > 0 ? (
                      article.relatedAssets.map((symbol, idx) => (
                        <span
                          key={`${symbol}-${idx}`}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--text-secondary)]"
                        >
                          {symbol}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">Macro / General</span>
                    )}
                  </div>

                  <button
                    className="button-secondary text-[11px] py-1 px-2.5"
                    disabled={entry?.loading}
                    onClick={() => onAnalyze(article)}
                  >
                    {entry?.loading ? 'Analyzing…' : `AI Sentiment (${engine === 'gemini' ? 'Gemini' : 'FinBERT'})`}
                  </button>
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
        </div>
      )}
    </section>
  );
}
