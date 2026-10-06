import { ExternalLink, Newspaper } from 'lucide-react';
import type { AnalysisEntry, Engine, NewsArticle, NewsResponse } from '../types/market';
import { analysisKey } from '../hooks/useAIAnalysis';
import { safeArticleUrl } from '../services/api';
import { formatTime } from '../utils/format';
import { Empty, ErrorNotice, Loading } from './Feedback';
import AnalysisResult from './AnalysisResult';

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
    <section className="panel">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="section-heading">
            <Newspaper className="h-5 w-5 text-indigo-400" />
            Financial News & Sentiment
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Real-time market headlines with on-demand AI sentiment classification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Analysis Engine</span>
            <select
              className="field text-xs py-1.5"
              value={engine}
              onChange={(e) => onEngine(e.target.value as Engine)}
            >
              <option value="gemini">Gemini LLM</option>
              <option value="finbert">FinBERT (NLP)</option>
            </select>
          </label>
          <button className="button-secondary text-xs py-1.5" disabled={loading} onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {(error || data?.error) && (
        <div className="mb-4">
          <ErrorNotice message={error ?? data?.error ?? ''} onRetry={onRefresh} />
        </div>
      )}

      {loading && !data ? (
        <Loading label="Loading headlines…" />
      ) : !articles.length ? (
        <Empty
          title={search ? 'No matching news' : 'No news available'}
          detail={search ? 'Try another search term.' : 'No articles returned by provider.'}
        />
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const entry = entries[analysisKey(`news:${article.id}`, engine)];
            const url = safeArticleUrl(article.url);
            return (
              <article
                key={article.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 transition hover:border-slate-700/80"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-bold text-indigo-300">{article.source}</span>
                  <time dateTime={article.publishedAt} className="text-[11px] text-slate-500">
                    {formatTime(article.publishedAt)}
                  </time>
                </div>
                <h3 className="text-sm font-semibold leading-snug text-slate-100">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition hover:text-indigo-300"
                    >
                      {article.headline}
                      <ExternalLink className="ml-1.5 inline h-3.5 w-3.5 text-slate-500" />
                    </a>
                  ) : (
                    article.headline
                  )}
                </h3>
                {article.summary && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-400 line-clamp-2">
                    {article.summary}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {article.relatedAssets.map((symbol, idx) => (
                      <span
                        key={`${symbol}-${idx}`}
                        className="rounded border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                      >
                        {symbol}
                      </span>
                    ))}
                  </div>
                  <button
                    className="rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-2.5 py-1 text-xs font-semibold transition"
                    disabled={entry?.loading}
                    onClick={() => onAnalyze(article)}
                  >
                    {entry?.loading ? 'Analyzing…' : `AI Analysis`}
                  </button>
                </div>

                {entry && (
                  <div className="mt-3 border-t border-slate-800/60 pt-3">
                    {entry.loading && <Loading label="Running AI analysis…" />}
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
