import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, X } from 'lucide-react';
import Header from './components/Header';
import DesktopAppPanel from './components/DesktopAppPanel';
import { ResearchProvider } from './hooks/useResearchStore';
import TickerTape from './components/TickerTape';
import SettingsPanel from './components/SettingsPanel';
import MarketPanel from './components/MarketPanel';
import NewsSignalFeed from './components/NewsSignalFeed';
import ScenarioSimulator from './components/ScenarioSimulator';
import OverviewPage from './components/OverviewPage';
import ProductDisclosuresModal from './components/ProductDisclosuresModal';
import UpdatePrompt from './components/UpdatePrompt';
import MobileBottomNav from './components/MobileBottomNav';
import { ErrorNotice, Loading } from './components/Feedback';
import { useMarketData, useNews } from './hooks/useMarketData';
import { useAIAnalysis, analysisKey } from './hooks/useAIAnalysis';
import type { Engine, Quote, Tab, ThemeType } from './types/market';
import { useRouter } from './utils/router';
import { ASSET_BY_SYMBOL } from '../shared/assets';

const AssetDetail = lazy(() => import('./components/AssetDetail'));
const ResearchChat = lazy(() => import('./components/ResearchChat'));
const WatchlistPage = lazy(() => import('./components/WatchlistPage'));
const ResearchDesk = lazy(() => import('./components/ResearchDesk'));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-xl p-8">
        <ErrorNotice message="The application could not render. Please reload to recover." />
        <button
          className="button-primary mt-4"
          onClick={() => window.location.reload()}
        >
          Reload application
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ResearchProvider><MainApp /></ResearchProvider>
    </ErrorBoundary>
  );
}

function MainApp() {
  // Theme state: exactly TWO modes ('light' | 'dark'), persisted in localStorage
  const [theme, setTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Client-side router managing clean URLs with browser history
  const [route, navigate] = useRouter();
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => window.location.pathname === '/research');
  const [chatSymbol, setChatSymbol] = useState('');
  const [disclosuresOpen, setDisclosuresOpen] = useState(false);
  const [engine, setEngine] = useState<Engine>('gemini');

  // Market subcategory selection for Markets page
  const [marketCategory, setMarketCategory] = useState<'all' | 'us' | 'india' | 'crypto' | 'commodities'>('all');

  const market = useMarketData();
  const news = useNews();
  const ai = useAIAnalysis();

  const handleSelectAsset = (quote: Quote) => {
    navigate(`/asset/${encodeURIComponent(quote.symbol)}`);
  };

  const handleCloseAsset = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/markets');
    }
  };

  const handleNavigate = (page: Tab) => {
    switch (page) {
      case 'watchlist':
      case 'desk':
        navigate(`/${page}`);
        break;
      case 'overview':
        navigate('/');
        break;
      case 'markets':
        navigate('/markets');
        break;
      case 'news':
        navigate('/news');
        break;
      case 'scenarios':
        navigate('/scenarios');
        break;
      case 'diagnostics':
        navigate('/diagnostics');
        break;
    }
  };

  const refreshAll = () => {
    market.refresh();
    news.refresh();
  };

  // Resolve current active asset for /asset/:symbol
  const fallbackAsset = route.symbol ? ASSET_BY_SYMBOL.get(route.symbol) : undefined;
  const currentQuote: Quote | null =
    (route.symbol ? market.quotes.find((q) => q.symbol === route.symbol) : null) ??
    (fallbackAsset
      ? {
          symbol: fallbackAsset.symbol,
          name: fallbackAsset.name,
          category: fallbackAsset.category,
          currency: fallbackAsset.currency,
          sector: fallbackAsset.sector,
          price: null,
          change: null,
          changePercent: null,
          volume: null,
          provider: 'Loading provider data…',
          asOf: null,
          fetchedAt: new Date().toISOString(),
          cached: false,
          status: 'delayed',
          session: { state: 'UNKNOWN', timezone: 'UTC', note: 'Initializing quote observation…' },
        }
      : null);

  // Filtered quotes based on honest search across 42 instruments
  const filteredQuotes = market.quotes.filter((quote) =>
    `${quote.symbol} ${quote.name} ${quote.sector ?? ''} ${quote.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const panels = [
    {
      category: 'us',
      title: 'US Equities & ETFs',
      description: 'US large-cap equities and SPY ETF quotes with NYSE session calendar.',
    },
    {
      category: 'india',
      title: 'Indian Equities & Indices',
      description: 'NIFTY 50, SENSEX, and benchmark NSE / BSE equities from Upstox.',
    },
    {
      category: 'crypto',
      title: 'Digital Assets',
      description: '24/7 spot cryptocurrency spot prices and 24h rolling volume from CoinGecko.',
    },
    {
      category: 'commodities',
      title: 'Precious Metals & Forex',
      description: 'Spot gold and silver in USD per troy ounce, and USD/INR reference exchange rates.',
    },
  ];

  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col justify-between"
    >
      <div>
        {/* Application Header Shell */}
        <Header
          theme={theme}
          onDesktop={() => setDesktopOpen(true)}
          onTheme={setTheme}
          search={search}
          onSearch={setSearch}
          tab={route.page}
          onNavigate={handleNavigate}
          settingsOpen={settingsOpen || route.page === 'diagnostics'}
          onSettings={() => {
            if (route.page === 'diagnostics') {
              navigate('/overview');
            } else {
              setSettingsOpen((v) => !v);
            }
          }}
          loading={market.loading || news.loading}
          secondsUntilRefresh={market.secondsUntilRefresh}
          connected={market.connected}
          onRefresh={refreshAll}
          onOpenDisclosures={() => setDisclosuresOpen(true)}
        />

        {/* Global Benchmark Ticker Tape */}
        <TickerTape
          quotes={market.quotes.filter((q) =>
            ['SPY', 'NIFTY50', 'SENSEX', 'BTC', 'ETH', 'XAU', 'XAG', 'USD/INR'].includes(q.symbol)
          )}
          loading={market.loading}
          paused={market.paused}
          secondsUntilRefresh={market.secondsUntilRefresh}
          onRefresh={refreshAll}
          onSelect={handleSelectAsset}
        />

        {/* Main Content Area */}
        <main
          id="main-content"
          className="mx-auto max-w-[1440px] w-full px-3 py-4 sm:px-6 lg:px-8 pb-24 md:pb-8 space-y-6"
        >
          {/* Active Search Banner */}
          {search.trim() && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] px-4 py-2 text-xs">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">
                  Search results for &ldquo;{search}&rdquo;:
                </span>{' '}
                <span className="text-[var(--text-secondary)]">
                  {filteredQuotes.length} matching instruments out of 42 tracked assets
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label="Clear search filter"
              >
                <span>Clear</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Provider Settings / Diagnostics Panel (when drawer opened or route is /diagnostics) */}
          {(settingsOpen || route.page === 'diagnostics') && (
            <SettingsPanel
              onClose={() => {
                setSettingsOpen(false);
                if (route.page === 'diagnostics') navigate('/');
              }}
            />
          )}

          {/* Global Network Error Notice */}
          {market.error && (
            <ErrorNotice message={market.error} onRetry={market.refresh} />
          )}

          {/* PAGE ROUTING */}
          {route.page === 'desk' && <Suspense fallback={<Loading label="Loading research desk…" />}><ResearchDesk theme={theme} initialSymbol={new URLSearchParams(window.location.search).get('symbol') ?? 'RELIANCE'} /></Suspense>}
          {route.page === 'watchlist' && <Suspense fallback={<Loading label="Loading watchlist…" />}><WatchlistPage quotes={market.quotes} loading={market.loading} onSelect={handleSelectAsset} /></Suspense>}
          {route.page === 'overview' && (
            <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
              <OverviewPage
                quotes={filteredQuotes}
                loading={market.loading}
                newsArticles={news.data?.articles ?? []}
                newsLoading={news.loading}
                onSelectAsset={handleSelectAsset}
                onNavigate={handleNavigate}
                onRefresh={refreshAll}
              />
            </div>
          )}

          {route.page === 'markets' && (
            <div role="tabpanel" id="panel-markets" aria-labelledby="tab-markets" className="space-y-5">
              {/* Markets Header & Category Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="section-heading text-lg font-bold">
                    <span>Markets Directory</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Comprehensive multi-asset coverage across 42 verified instruments.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="button-secondary text-xs"
                    onClick={market.refresh}
                    disabled={market.loading}
                  >
                    <RefreshCw className={`h-3 w-3 ${market.loading ? 'animate-spin' : ''}`} />
                    <span>Refresh Markets</span>
                  </button>
                </div>
              </div>

              {/* Category Segment Tabs */}
              <div
                className="flex flex-wrap gap-1.5 border-b border-[var(--border-subtle)] pb-3"
                role="tablist"
                aria-label="Market Categories"
              >
                {[
                  { id: 'all', label: 'All Markets (42)' },
                  { id: 'us', label: 'US Equities (8)' },
                  { id: 'india', label: 'Indian Equities (25)' },
                  { id: 'crypto', label: 'Digital Assets (5)' },
                  { id: 'commodities', label: 'Metals & FX (3)' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={marketCategory === cat.id}
                    onClick={() => setMarketCategory(cat.id as typeof marketCategory)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      marketCategory === cat.id
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Render Selected Panels */}
              <div className="space-y-6">
                {panels
                  .filter((p) => {
                    if (marketCategory === 'all') return true;
                    if (marketCategory === 'us') return p.category === 'us';
                    if (marketCategory === 'india') return p.category === 'india';
                    if (marketCategory === 'crypto') return p.category === 'crypto';
                    if (marketCategory === 'commodities') return p.category === 'commodities';
                    return true;
                  })
                  .map((panel) => {
                    const panelQuotes = filteredQuotes.filter((q) =>
                      panel.category === 'commodities'
                        ? ['commodities', 'forex'].includes(q.category)
                        : q.category === panel.category
                    );
                    return (
                      <MarketPanel
                        key={panel.category}
                        title={panel.title}
                        description={panel.description}
                        quotes={panelQuotes}
                        loading={market.loading}
                        onSelect={handleSelectAsset}
                        sectors={panel.category === 'india' || panel.category === 'us'}
                        layout={panel.category === 'crypto' ? 'cards' : 'table'}
                      />
                    );
                  })}
              </div>
            </div>
          )}

          {route.page === 'news' && (
            <div role="tabpanel" id="panel-news" aria-labelledby="tab-news">
              <NewsSignalFeed
                data={news.data}
                loading={news.loading}
                error={news.error}
                search={search}
                engine={engine}
                onEngine={setEngine}
                entries={ai.entries}
                onAnalyze={(article) => void ai.run(`news:${article.id}`, article.headline, engine)}
                onRefresh={news.refresh}
              />
            </div>
          )}

          {route.page === 'scenarios' && (
            <div role="tabpanel" id="panel-scenarios" aria-labelledby="tab-scenarios">
              <ScenarioSimulator />
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-5 text-center text-xs leading-relaxed text-[var(--text-muted)]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 space-y-1.5">
          <p>
            Market telemetry is sourced directly from authenticated provider integrations. Real-time observations may experience session delays outside open market hours.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => setDisclosuresOpen(true)}
              className="font-semibold text-[var(--accent-text)] hover:underline"
            >
              Data Sources, Attribution, Methodology & Legal Disclosures
            </button>
            <span>·</span>
            <span>Educational Research Prototype</span>
            <span>·</span>
            <span>No Automated Trading Execution</span>
          </div>
        </div>
      </footer>

      {/* Legal & Product Disclosures Modal */}
      <DesktopAppPanel open={desktopOpen} onClose={() => setDesktopOpen(false)} />
      <Suspense fallback={null}><ResearchChat open={chatOpen} onOpenChange={setChatOpen} symbol={chatSymbol} onClearFocus={() => setChatSymbol('')} /></Suspense>
      <ProductDisclosuresModal open={disclosuresOpen} onClose={() => setDisclosuresOpen(false)} />

      {/* Asset Detail Dialog / Direct Link Modal */}
      {currentQuote && (
        <Suspense fallback={<Loading label={`Loading ${currentQuote.symbol} details…`} />}>
          <AssetDetail
            key={currentQuote.symbol}
            quote={currentQuote}
            onClose={handleCloseAsset}
            onWorkspace={() => navigate(`/desk?symbol=${encodeURIComponent(currentQuote.symbol)}`)}
            onAsk={() => { setChatSymbol(currentQuote.symbol); setChatOpen(true); navigate('/markets'); }}
            engine={engine}
            onEngine={setEngine}
            theme={theme}
            entry={ai.entries[analysisKey(`asset:${currentQuote.symbol}`, engine)]}
            onAnalyze={() =>
              void ai.run(
                `asset:${currentQuote.symbol}`,
                `Assess the available market evidence for ${currentQuote.name} (${currentQuote.symbol}).`,
                engine,
                currentQuote.symbol
              )
            }
          />
        </Suspense>
      )}

      {/* PWA In-App Update Prompt */}
      <UpdatePrompt />

      {/* Native Mobile Bottom Navigation Bar */}
      <MobileBottomNav currentTab={route.page} onNavigate={handleNavigate} />
    </div>
  );
}
