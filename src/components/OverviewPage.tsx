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
  BarChart2,
  Clock,
  Plus,
} from 'lucide-react';
import type { NewsArticle, Quote, Tab } from '../types/market';
import {
  formatChange,
  formatPercent,
  formatPrice,
  formatTime,
  isIndexInstrument,
} from '../utils/format';
import { Loading } from './Feedback';
import { useWatchlist } from '../hooks/useWatchlist';
import WatchlistToggle from './WatchlistToggle';

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

const RECOMMENDED_INDIAN_STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'];

function BenchmarkCard({
  quote,
  onSelect,
}: {
  quote: Quote;
  onSelect: (quote: Quote) => void;
}) {
  const hasChange = quote.changePercent !== null && Number.isFinite(quote.changePercent);
  const isGain = (quote.changePercent ?? 0) >= 0;
  const isIndex = isIndexInstrument(quote.symbol, quote.sector, quote.currency);

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
      className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition duration-150 hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition truncate">
            {quote.symbol}
          </span>
          {quote.status === 'live' && (
            <span className="relative flex h-1.5 w-1.5 shrink-0" title="Real-time quote">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          )}
        </div>
        <span className="text-xs shrink-0">{flag}</span>
      </div>

      <span className="truncate text-[11px] text-[var(--text-muted)] mt-0.5 block w-full">
        {quote.name}
      </span>

      <div className="mt-2">
        <div className="font-mono text-xs sm:text-sm font-bold tabular-nums text-[var(--text-primary)]">
          {formatPrice(quote.price, quote.currency, isIndex)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
              !hasChange
                ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                : isGain
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {hasChange && (isGain ? <TrendingUp className="h-2.5 w-2.5 shrink-0" /> : <TrendingDown className="h-2.5 w-2.5 shrink-0" />)}
            {formatPercent(quote.changePercent)}
          </span>
          {quote.change !== null && Number.isFinite(quote.change) && (
            <span className="font-mono text-[10px] text-[var(--text-muted)] tabular-nums hidden xs:inline">
              {formatChange(quote.change, quote.currency, isIndex)}
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
  const { symbols, toggle } = useWatchlist();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'india' | 'us' | 'crypto' | 'commodities'>('india');
  const [defaultLanding, setDefaultLanding] = useState<'overview' | 'watchlist'>(() => {
    return (localStorage.getItem('default_landing_page') as 'overview' | 'watchlist') || 'overview';
  });

  const [showTip, setShowTip] = useState(() => {
    return localStorage.getItem('hide_overview_tip') !== 'true';
  });

  const dismissTip = () => {
    setShowTip(false);
    localStorage.setItem('hide_overview_tip', 'true');
  };

  const handleDefaultLandingChange = (val: 'overview' | 'watchlist') => {
    setDefaultLanding(val);
    localStorage.setItem('default_landing_page', val);
  };

  // Indian benchmarks together, followed by Global benchmarks
  const benchmarkSymbols = ['NIFTY50', 'BANKNIFTY', 'SENSEX', 'SPY', 'BTC', 'XAU', 'USD/INR'];
  const benchmarks = benchmarkSymbols
    .map((sym) => quotes.find((q) => q.symbol === sym))
    .filter((q): q is Quote => Boolean(q));

  // User's Watchlist Quotes
  const watchlistQuotes = symbols
    .map((s) => quotes.find((q) => q.symbol === s))
    .filter((q): q is Quote => Boolean(q));

  // Last viewed chart symbol
  const lastChartSymbol = localStorage.getItem('last_chart_symbol') || 'RELIANCE';
  const lastChartQuote = quotes.find((q) => q.symbol === lastChartSymbol) || quotes.find((q) => q.symbol === 'RELIANCE');

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
              Multi-asset research telemetry across {quotes.length} tracked instruments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Default Landing Page Picker */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs">
            <span className="text-[var(--text-muted)] text-[11px]">Start page:</span>
            <select
              aria-label="Default landing page"
              value={defaultLanding}
              onChange={(e) => handleDefaultLandingChange(e.target.value as 'overview' | 'watchlist')}
              className="bg-transparent font-medium text-[var(--text-primary)] text-xs border-none outline-none cursor-pointer"
            >
              <option value="overview">Overview</option>
              <option value="watchlist">Watchlist</option>
            </select>
          </div>

          <button
            type="button"
            className="button-secondary text-xs min-h-[44px] py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            onClick={() => onNavigate('watchlist')}
          >
            <Star className="h-3.5 w-3.5 text-amber-400" />
            <span>Watchlist ({symbols.length})</span>
          </button>
          <button
            type="button"
            className="button-primary text-xs min-h-[44px] py-1.5 px-3 rounded-lg flex items-center gap-1.5"
            onClick={() => onNavigate('markets')}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Markets</span>
          </button>
        </div>
      </div>

      {/* TOP SECTION: User Watchlist & Continue Last Chart */}
      <section className="grid gap-3 sm:grid-cols-2">
        {/* Watchlist Hub Card */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2.5">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span>My Watchlist</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('watchlist')}
                className="text-[11px] font-medium text-[var(--accent-text)] hover:underline flex items-center gap-0.5"
              >
                <span>Manage</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {watchlistQuotes.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {watchlistQuotes.slice(0, 4).map((q) => {
                  const isGain = (q.changePercent ?? 0) >= 0;
                  const isIndex = isIndexInstrument(q.symbol, q.sector, q.currency);
                  return (
                    <div
                      key={q.symbol}
                      className="flex items-center justify-between rounded-lg p-1.5 hover:bg-[var(--bg-surface-hover)] transition text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectAsset(q)}
                        className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="font-bold text-[var(--text-primary)]">{q.symbol}</span>
                        <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{q.name}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-[var(--text-primary)]">
                          {formatPrice(q.price, q.currency, isIndex)}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                            isGain ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                          }`}
                        >
                          {formatPercent(q.changePercent)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-2 space-y-2">
                <p className="text-xs text-[var(--text-secondary)]">
                  Save stocks to track quotes, compare setups, and filter news.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {RECOMMENDED_INDIAN_STOCKS.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => void toggle(sym)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>{sym}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {watchlistQuotes.length > 4 && (
            <p className="mt-2 text-[11px] text-[var(--text-muted)] text-right">
              +{watchlistQuotes.length - 4} more stocks saved
            </p>
          )}
        </div>

        {/* Continue Last Chart Card */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2.5">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                <Clock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Continue Last Chart</span>
              </h2>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Workspace</span>
            </div>

            {lastChartQuote ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{lastChartQuote.symbol}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{lastChartQuote.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">
                      {formatPrice(lastChartQuote.price, lastChartQuote.currency, isIndexInstrument(lastChartQuote.symbol, lastChartQuote.sector, lastChartQuote.currency))}
                    </div>
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        (lastChartQuote.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPercent(lastChartQuote.changePercent)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Resume candlestick chart analysis, saved trendlines, and risk planning for {lastChartQuote.name}.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No recent chart viewed yet.</p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const sym = lastChartQuote?.symbol ?? 'RELIANCE';
                localStorage.setItem('last_chart_symbol', sym);
                onNavigate('desk');
              }}
              className="button-primary text-xs min-h-[44px] flex-1 rounded-lg flex items-center justify-center gap-1.5"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Open {lastChartQuote?.symbol ?? 'RELIANCE'} Chart</span>
            </button>
          </div>
        </div>
      </section>

      {/* Simple First-Use Flow: 3-Step Guided Roadmap */}
      {showTip && (
        <section className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Getting Started with Tradexa</span>
            </div>
            <button
              type="button"
              onClick={dismissTip}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1 cursor-pointer"
              aria-label="Dismiss guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
            <div className="rounded-lg bg-[var(--bg-subtle)] p-2.5 space-y-1">
              <span className="font-semibold text-[var(--accent-text)] block">1. Save Stocks</span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Star Indian stocks (e.g. RELIANCE, TCS) to build your personal watchlist.
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-subtle)] p-2.5 space-y-1">
              <span className="font-semibold text-[var(--accent-text)] block">2. Analyze Charts</span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Examine real candles, draw support & resistance levels, and review indicators.
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-subtle)] p-2.5 space-y-1">
              <span className="font-semibold text-[var(--accent-text)] block">3. Plan Your Risk</span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Validate stop-loss, target, and reward/risk ratios before trading.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Market Benchmarks Deck (NIFTY 50, BANK NIFTY, SENSEX prominently together) */}
      <section aria-labelledby="benchmarks-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id="benchmarks-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Market benchmarks
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">Real provider telemetry</span>
        </div>

        {loading && !quotes.length ? (
          <Loading label="Loading market benchmarks…" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
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

      {/* Category Filter Pills & Instrument Directory */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['india', 'all', 'us', 'crypto', 'commodities'] as const).map((cat) => {
              const info = CATEGORY_MAP[cat];
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer min-h-[44px] ${
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

        {/* Clean Responsive Quotes Grid with Direct Watchlist Save/Remove */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {displayQuotes.slice(0, 12).map((quote) => {
            const isGain = (quote.changePercent ?? 0) >= 0;
            const isIndex = isIndexInstrument(quote.symbol, quote.sector, quote.currency);
            return (
              <div
                key={quote.symbol}
                className="group w-full flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onSelectAsset(quote)}
                  className="min-w-0 pr-2 text-left flex-1 cursor-pointer"
                >
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
                </button>

                <div className="flex items-center gap-2">
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatPrice(quote.price, quote.currency, isIndex)}
                    </div>
                    <div className="mt-0.5">
                      <span
                        className={`inline-block font-mono text-[10px] font-semibold tabular-nums ${
                          isGain ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatPercent(quote.changePercent)}
                      </span>
                    </div>
                  </div>
                  <WatchlistToggle symbol={quote.symbol} compact />
                </div>
              </div>
            );
          })}
        </div>

        {displayQuotes.length > 12 && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => onNavigate('markets')}
              className="button-secondary text-xs min-h-[44px] py-1.5 px-4 rounded-xl"
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
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>Top Gainers</span>
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">Reported Change</span>
          </div>

          <div className="space-y-1.5">
            {sortedGainers.map((quote) => (
              <button
                type="button"
                key={quote.symbol}
                onClick={() => onSelectAsset(quote)}
                className="w-full text-left flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-[var(--text-primary)]">{quote.symbol}</span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{quote.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    {formatPrice(quote.price, quote.currency, isIndexInstrument(quote.symbol, quote.sector, quote.currency))}
                  </span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
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
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
              <TrendingDown className="h-4 w-4" />
              <span>Top Decliners</span>
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">Reported Change</span>
          </div>

          <div className="space-y-1.5">
            {sortedLosers.map((quote) => (
              <button
                type="button"
                key={quote.symbol}
                onClick={() => onSelectAsset(quote)}
                className="w-full text-left flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-[var(--text-primary)]">{quote.symbol}</span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{quote.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                    {formatPrice(quote.price, quote.currency, isIndexInstrument(quote.symbol, quote.sector, quote.currency))}
                  </span>
                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-400 border border-rose-500/20">
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Market News & Scenario Hub */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* News Feed Preview */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              <Newspaper className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Market News & Context</span>
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
              <span>Scenario Simulation</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Explore hypothetical interest rate decisions, commodity shocks, and macro events with structured reasoning.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('scenarios')}
            className="button-primary mt-4 w-full text-xs min-h-[44px] py-2 rounded-xl flex items-center justify-center gap-2"
          >
            <span>Run Scenarios</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
