import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Newspaper,
  FlaskConical,
  Layers,
  Sparkles,
  X,
  Star,
  ChevronRight,
} from 'lucide-react';
import type { NewsArticle, Quote, Tab } from '../types/market';
import { formatChange, formatPercent, formatPrice, formatTime } from '../utils/format';
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

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  all: { label: 'All Instruments', icon: '🌐' },
  india: { label: 'Indian Equities', icon: '🇮🇳' },
  us: { label: 'US Equities', icon: '🇺🇸' },
  crypto: { label: 'Digital Assets', icon: '🪙' },
  commodities: { label: 'Metals & FX', icon: '🏆' },
};

function BenchmarkCard({
  quote,
  onSelect,
}: {
  quote: Quote;
  onSelect: (quote: Quote) => void;
}) {
  const hasChange = quote.changePercent !== null && Number.isFinite(quote.changePercent);
  const isGain = (quote.changePercent ?? 0) >= 0;
  const isLive = quote.status === 'live';

  const flag =
    quote.category === 'india'
      ? '🇮🇳'
      : quote.category === 'us'
      ? '🇺🇸'
      : quote.category === 'crypto'
      ? '🪙'
      : '🏆';

  return (
    <button
      type="button"
      onClick={() => onSelect(quote)}
      className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition-colors duration-150 hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)] hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition truncate">
            {quote.symbol}
          </span>
          {isLive && (
            <span className="relative flex h-1.5 w-1.5 shrink-0" title="Live streaming real-time quote">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          )}
        </div>
        <span className="text-xs shrink-0">{flag}</span>
      </div>

      <span className="truncate text-[11px] text-[var(--text-muted)] mt-0.5 block w-full">
        {quote.name}
      </span>

      <div className="mt-2.5">
        <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-[var(--text-primary)]">
          {formatPrice(quote.price, quote.currency)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
              !hasChange
                ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                : isGain
                ? 'bg-emerald-500/10 text-[var(--gain-text)] border border-emerald-500/20'
                : 'bg-rose-500/10 text-[var(--loss-text)] border border-rose-500/20'
            }`}
          >
            {hasChange && (
              isGain ? (
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5 shrink-0" />
              )
            )}
            {formatPercent(quote.changePercent)}
          </span>
          {quote.change !== null && Number.isFinite(quote.change) && (
            <span className="font-mono text-[10px] text-[var(--text-muted)] tabular-nums hidden xs:inline">
              {formatChange(quote.change, quote.currency)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function OverviewPage({
  quotes,
  loading,
  newsArticles,
  newsLoading,
  onSelectAsset,
  onNavigate,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'india' | 'us' | 'crypto' | 'commodities'>('all');
  const [showTip, setShowTip] = useState(() => {
    return localStorage.getItem('hide_overview_tip') !== 'true';
  });

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem('hide_overview_tip', 'true');
  };

  // Core benchmark instruments
  const benchmarkSymbols = ['NIFTY50', 'SENSEX', 'SPY', 'BTC', 'XAU', 'USD/INR'];
  const benchmarks = benchmarkSymbols
    .map((sym) => quotes.find((q) => q.symbol === sym))
    .filter((q): q is Quote => Boolean(q));

  // Gainers & Losers
  const quotesWithChanges = quotes.filter(
    (q) => q.changePercent !== null && q.price !== null && !['unavailable', 'stale'].includes(q.status)
  );
  const sortedGainers = quotesWithChanges
    .filter((q) => (q.changePercent ?? 0) > 0)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
    .slice(0, 5);
  const sortedLosers = quotesWithChanges
    .filter((q) => (q.changePercent ?? 0) < 0)
    .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
    .slice(0, 5);

  // Filtered quotes for quick list
  const displayQuotes = quotes.filter((q) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'commodities') return ['commodities', 'forex'].includes(q.category);
    return q.category === selectedCategory;
  });

  return (
    <div className="space-y-5">
      {/* Sleek Market Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-tight">
              Market Dashboard
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              Quotes across {quotes.length} tracked instruments · check each observation’s status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="button-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            onClick={() => onNavigate('watchlist')}
          >
            <Star className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xs:inline">My</span> Watchlist
          </button>
          <button
            type="button"
            className="button-primary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            onClick={() => onNavigate('markets')}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All Markets</span>
          </button>
        </div>
      </div>

      {/* Optional Compact Dismissible Quick-Tip */}
      {showTip && (
        <div className="relative flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-subtle)] p-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">
              <strong>Tip:</strong> Tap any asset card or row below to view full candlestick charts, price history, and AI sentiment signals.
            </span>
          </div>
          <button
            type="button"
            onClick={dismissTip}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1 shrink-0"
            title="Dismiss tip"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Benchmark Indices Deck */}
      <section aria-labelledby="benchmarks-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id="benchmarks-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Core Market Indices
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">Provider observations</span>
        </div>

        {loading && !quotes.length ? (
          <Loading label="Loading market indices…" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {benchmarks.map((quote) => (
              <BenchmarkCard
                key={quote.symbol}
                quote={quote}
                onSelect={onSelectAsset}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick Category Filter Pills */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'india', 'us', 'crypto', 'commodities'] as const).map((cat) => {
              const info = CATEGORY_MAP[cat];
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('markets')}
            className="hidden sm:flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline whitespace-nowrap ml-2"
          >
            <span>Full Directory</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Clean Responsive Quotes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {displayQuotes.slice(0, 12).map((quote) => {
            const isGain = (quote.changePercent ?? 0) >= 0;
            return (
              <button
                type="button"
                key={quote.symbol}
                onClick={() => onSelectAsset(quote)}
                className="group w-full text-left flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition cursor-pointer shadow-sm"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition">
                      {quote.symbol}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">
                      {quote.sector ?? quote.category.toUpperCase()}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-[var(--text-muted)] mt-0.5">
                    {quote.name}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatPrice(quote.price, quote.currency)}
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={`inline-block font-mono text-[10px] font-semibold tabular-nums ${
                        isGain ? 'text-[var(--gain-text)]' : 'text-[var(--loss-text)]'
                      }`}
                    >
                      {formatPercent(quote.changePercent)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {displayQuotes.length > 12 && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="button-secondary text-xs py-1.5 px-4 rounded-xl"
            >
              View all {displayQuotes.length} instruments in {CATEGORY_MAP[selectedCategory].label}
            </button>
          </div>
        )}
      </section>

      {/* Top Gainers & Losers */}
      <section className="grid gap-3 sm:grid-cols-2">
        {/* Gainers */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--gain-text)]">
              <TrendingUp className="h-4 w-4" />
              <span>Top Gainers</span>
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">Reported change</span>
          </div>

          <div className="space-y-1.5">
            {sortedGainers.map((quote) => (
              <button
                type="button"
                key={quote.symbol}
                onClick={() => onSelectAsset(quote)}
                className="w-full min-h-11 text-left flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-[var(--text-primary)]">{quote.symbol}</span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{quote.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    {formatPrice(quote.price, quote.currency)}
                  </span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--gain-text)] border border-emerald-500/20">
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Losers */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--loss-text)]">
              <TrendingDown className="h-4 w-4" />
              <span>Top Decliners</span>
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">Reported change</span>
          </div>

          <div className="space-y-1.5">
            {sortedLosers.map((quote) => (
              <button
                type="button"
                key={quote.symbol}
                onClick={() => onSelectAsset(quote)}
                className="w-full min-h-11 text-left flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-[var(--text-primary)]">{quote.symbol}</span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{quote.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    {formatPrice(quote.price, quote.currency)}
                  </span>
                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--loss-text)] border border-rose-500/20">
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Market News & Scenarios */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* News Feed */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              <Newspaper className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Verified Market News</span>
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
            <Loading label="Fetching latest headlines…" />
          ) : newsArticles.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-muted)]">
              No recent news articles available.
            </p>
          ) : (
            <div className="space-y-2">
              {newsArticles.slice(0, 3).map((article) => (
                <article
                  key={article.id}
                  onClick={() => onNavigate('news')}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-2.5 text-xs hover:border-[var(--border-default)] transition cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--accent-text)]">{article.source}</span>
                    <time dateTime={article.publishedAt}>{formatTime(article.publishedAt)}</time>
                  </div>
                  <h4 className="mt-1 font-medium text-[var(--text-primary)] line-clamp-1 hover:text-[var(--accent-text)] transition">
                    {article.headline}
                  </h4>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* AI & Scenario Assistant Card */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-2">
              <FlaskConical className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>AI Scenario Simulation</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Simulate interest rate decisions, commodity shocks, and geopolitical macro shifts with structured Gemini reasoning.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('scenarios')}
            className="button-primary mt-4 w-full text-xs py-2 rounded-xl flex items-center justify-center gap-2"
          >
            <span>Run Scenarios</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
