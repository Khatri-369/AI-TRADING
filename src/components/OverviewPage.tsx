import { Activity, ArrowRight, TrendingDown, TrendingUp, Newspaper, FlaskConical, Layers, Globe } from 'lucide-react';
import type { NewsArticle, Quote, Tab } from '../types/market';
import { changeClass, formatPercent, formatPrice, formatTime } from '../utils/format';
import StatusBadge from './StatusBadge';
import { Loading } from './Feedback';

interface Props {
  quotes: Quote[];
  loading: boolean;
  newsArticles: NewsArticle[];
  newsLoading: boolean;
  onSelectAsset: (quote: Quote) => void;
  onNavigate: (tab: Tab) => void;
  onRefresh: () => void;
}

export default function OverviewPage({
  quotes,
  loading,
  newsArticles,
  newsLoading,
  onSelectAsset,
  onNavigate,
}: Props) {
  // Key Benchmark Symbols (core equity benchmarks across markets)
  const benchmarkSymbols = ['SPY', 'NIFTY50', 'SENSEX', 'RELIANCE', 'BTC', 'XAU', 'USD/INR'];
  const benchmarks = benchmarkSymbols
    .map((sym) => quotes.find((q) => q.symbol === sym))
    .filter((q): q is Quote => Boolean(q));

  // Calculate real gainers and losers from loaded quotes
  const quotesWithChanges = quotes.filter((q) => q.changePercent !== null && q.price !== null && !['unavailable', 'stale'].includes(q.status));
  const sortedGainers = quotesWithChanges.filter(q => (q.changePercent ?? 0) > 0)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
    .slice(0, 4);
  const sortedLosers = quotesWithChanges.filter(q => (q.changePercent ?? 0) < 0)
    .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
    .slice(0, 4);

  // Segment Counts
  const segments = [
    { id: 'us', name: 'US Equities & ETFs', count: quotes.filter((q) => q.category === 'us').length || 8, note: 'NYSE / NASDAQ benchmarks' },
    { id: 'india', name: 'Indian Equities & Indices', count: quotes.filter((q) => q.category === 'india').length || 25, note: 'NSE / BSE real-time stream' },
    { id: 'crypto', name: 'Digital Assets', count: quotes.filter((q) => q.category === 'crypto').length || 5, note: '24/7 spot crypto pricing' },
    { id: 'commodities', name: 'Precious Metals', count: quotes.filter((q) => q.category === 'commodities').length || 2, note: 'Gold & silver spot (USD/oz)' },
    { id: 'forex', name: 'Foreign Exchange', count: quotes.filter((q) => q.category === 'forex').length || 1, note: 'USD / INR reference rates' },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Market Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h2 className="section-heading text-lg font-bold">
            <Activity className="h-5 w-5 text-[var(--accent-primary)]" />
            <span>Market Intelligence</span>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5 font-medium text-[var(--gain-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--gain-text)]" />
              Source-verified telemetry
            </span>
            <span>·</span>
            <span>42 tracked instruments</span>
            <span>·</span>
            <span>No synthetic or simulated prices</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loading && (
            <div
              className="flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-text)]"
              role="status"
              aria-live="polite"
            >
              <Activity className="h-3.5 w-3.5 animate-spin text-[var(--accent-primary)]" />
              <span>Updating telemetry…</span>
            </div>
          )}
          <button
            type="button"
            className="button-secondary text-xs"
            onClick={() => onNavigate('markets')}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>View All Markets</span>
          </button>
        </div>
      </div>

      {/* Key Benchmark Spotlights */}
      <section aria-label="Research before a trade" className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h3 className="font-semibold">Make the evidence part of your trading process</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Use this workspace to build a shortlist, review the context and identify what is still unknown. A price move or AI sentiment score alone is not a complete trade thesis.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { title: '1. Build your shortlist', text: 'Save instruments and compare their source, currency, price change and observation time.', page: 'watchlist' as Tab, action: 'Open watchlist' },
            { title: '2. Check the evidence', text: 'Read the original headlines. Check whether data is delayed and whether news actually relates to your asset.', page: 'news' as Tab, action: 'Review news' },
            { title: '3. Challenge your thesis', text: 'Explore an alternative scenario and ask the assistant what evidence is missing before drawing a conclusion.', page: 'scenarios' as Tab, action: 'Explore scenarios' },
          ].map(step => <article key={step.title} className="rounded-lg bg-[var(--bg-subtle)] p-4"><h4 className="text-sm font-semibold">{step.title}</h4><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{step.text}</p><button className="button-secondary mt-3" onClick={() => onNavigate(step.page)}>{step.action}<ArrowRight size={14} /></button></article>)}
        </div>
      </section>
      <section aria-labelledby="benchmarks-heading">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="benchmarks-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Benchmark Core Indices
          </h3>
          <span className="text-[11px] text-[var(--text-muted)]">Real-time reference</span>
        </div>

        {loading && !quotes.length ? (
          <Loading label="Loading benchmark quotes…" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {benchmarks.map((quote) => (
              <button
                key={quote.symbol}
                type="button"
                onClick={() => onSelectAsset(quote)}
                className="group flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-text)]">
                    {quote.symbol}
                  </span>
                  <StatusBadge status={quote.status} cached={quote.cached} />
                </div>
                <span className="truncate text-[11px] text-[var(--text-muted)] mt-0.5">
                  {quote.name}
                </span>

                <div className="mt-3">
                  <p className="font-mono text-base font-bold tabular-nums text-[var(--text-primary)]">
                    {formatPrice(quote.price, quote.currency)}
                  </p>
                  <p className={`mt-0.5 font-mono text-[11px] tabular-nums ${changeClass(quote.changePercent)}`}>
                    {formatPercent(quote.changePercent)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Market Movers: Top Gainers & Decliners */}
      <section aria-labelledby="movers-heading" className="grid gap-4 md:grid-cols-2">
        {/* Top Gainers */}
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h3 id="movers-heading" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--gain-text)]">
              <TrendingUp className="h-4 w-4" />
              <span>Top Gainers Today</span>
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">Across tracked assets</span>
          </div>

          {sortedGainers.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              {loading ? 'Evaluating session movements…' : 'No positive movements recorded.'}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {sortedGainers.map((quote) => (
                <div
                  key={quote.symbol}
                  className="flex items-center justify-between py-2 text-xs"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectAsset(quote)}
                      className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)]"
                    >
                      {quote.symbol}
                    </button>
                    <span className="ml-2 text-[11px] text-[var(--text-muted)] truncate max-w-[140px] inline-block align-bottom">
                      {quote.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono tabular-nums text-[var(--text-primary)] font-medium">
                      {formatPrice(quote.price, quote.currency)}
                    </span>
                    <span className="ml-2 font-mono tabular-nums font-semibold text-[var(--gain-text)]">
                      {formatPercent(quote.changePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Decliners */}
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--loss-text)]">
              <TrendingDown className="h-4 w-4" />
              <span>Top Decliners Today</span>
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">Across tracked assets</span>
          </div>

          {sortedLosers.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              {loading ? 'Evaluating session movements…' : 'No negative movements recorded.'}
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {sortedLosers.map((quote) => (
                <div
                  key={quote.symbol}
                  className="flex items-center justify-between py-2 text-xs"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectAsset(quote)}
                      className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-text)]"
                    >
                      {quote.symbol}
                    </button>
                    <span className="ml-2 text-[11px] text-[var(--text-muted)] truncate max-w-[140px] inline-block align-bottom">
                      {quote.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono tabular-nums text-[var(--text-primary)] font-medium">
                      {formatPrice(quote.price, quote.currency)}
                    </span>
                    <span className="ml-2 font-mono tabular-nums font-semibold text-[var(--loss-text)]">
                      {formatPercent(quote.changePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Asset Class Directory Grid */}
      <section aria-labelledby="classes-heading">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="classes-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Market Coverage by Asset Class
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('markets')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline"
          >
            <span>Open Markets Directory</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {segments.map((seg) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => onNavigate('markets')}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
            >
              <div className="flex items-center justify-between">
                <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="rounded bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                  {seg.count} assets
                </span>
              </div>
              <h4 className="mt-2 text-xs font-bold text-[var(--text-primary)]">{seg.name}</h4>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{seg.note}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Secondary Row: Latest News Preview & Scenario Simulator Callout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* News Preview */}
        <div className="panel lg:col-span-2 p-4">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              <Newspaper className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Latest Market Intelligence Headlines</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('news')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline"
            >
              <span>View all news</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {newsLoading && !newsArticles.length ? (
            <Loading label="Fetching verified news headlines…" />
          ) : newsArticles.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              No recent news articles available.
            </p>
          ) : (
            <div className="space-y-2.5">
              {newsArticles.slice(0, 3).map((article) => (
                <article
                  key={article.id}
                  className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--accent-text)]">{article.source}</span>
                    <time dateTime={article.publishedAt}>{formatTime(article.publishedAt)}</time>
                  </div>
                  <h4 className="mt-1 font-medium text-[var(--text-primary)] line-clamp-1">
                    {article.headline}
                  </h4>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Macro Scenario Callout */}
        <div className="panel p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-2">
              <FlaskConical className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Macro Scenario Modeling</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Explore hypothetical macroeconomic interest rate, commodity shock, or policy shifts modeled with Gemini structured reasoning.
            </p>
            <div className="mt-3 rounded border border-[var(--delayed-border)] bg-[var(--delayed-bg)] p-2 text-[11px] text-[var(--delayed-text)]">
              Decoupled analytical models; entirely separate from live quote streams.
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('scenarios')}
            className="button-primary mt-4 w-full text-xs"
          >
            <span>Launch Scenario Lab</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
