import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import Header from './components/Header';
import TickerTape from './components/TickerTape';
import SettingsPanel from './components/SettingsPanel';
import MarketPanel from './components/MarketPanel';
import NewsSignalFeed from './components/NewsSignalFeed';
import ScenarioSimulator from './components/ScenarioSimulator';
import { ErrorNotice, Loading } from './components/Feedback';
import { useMarketData, useNews } from './hooks/useMarketData';
import { useAIAnalysis, analysisKey } from './hooks/useAIAnalysis';
import type { Engine, Quote, Tab, ThemeType } from './types/market';
const AssetDetail = lazy(() => import('./components/AssetDetail'));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-xl p-8">
        <ErrorNotice message="The dashboard could not render. Reload to recover." />
        <button className="button-primary mt-4" onClick={() => window.location.reload()}>
          Reload dashboard
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
      <Dashboard />
    </ErrorBoundary>
  );
}

function Dashboard() {
  const [theme, setTheme] = useState<ThemeType>('midnight');
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [engine, setEngine] = useState<Engine>('gemini');

  const market = useMarketData();
  const news = useNews();
  const ai = useAIAnalysis();

  const quotes = market.quotes.filter((quote) =>
    `${quote.symbol} ${quote.name} ${quote.sector ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const select = (quote: Quote) => setSelected(quote);
  const refresh = () => {
    market.refresh();
    news.refresh();
  };

  const current = selected ? market.quotes.find((quote) => quote.symbol === selected.symbol) ?? selected : null;

  const panels = [
    { category: 'us', title: 'US Equities', description: 'Live S&P 500, Nasdaq 100, and leading tech constituents.' },
    { category: 'india', title: 'Indian Equities & Indices', description: 'NIFTY 50, SENSEX, and benchmark Indian equities.' },
    { category: 'crypto', title: 'Digital Assets', description: 'Real-time cryptocurrency spot prices, 24h trends, and volume.' },
    { category: 'commodities', title: 'Precious Metals', description: 'Spot gold and silver pricing in USD per troy ounce.' },
    { category: 'forex', title: 'Foreign Exchange', description: 'USD / INR reference exchange rates.' },
  ];

  return (
    <div data-theme={theme} className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        theme={theme}
        onTheme={setTheme}
        search={search}
        onSearch={setSearch}
        tab={tab}
        onTab={setTab}
        settingsOpen={settings}
        onSettings={() => setSettings((v) => !v)}
      />

      <TickerTape
        quotes={market.quotes.filter((q) =>
          ['SPY', 'NIFTY50', 'SENSEX', 'BTC', 'ETH', 'XAU', 'XAG', 'USD/INR'].includes(q.symbol)
        )}
        loading={market.loading}
        paused={market.paused}
        onRefresh={refresh}
        onSelect={select}
      />

      <main id="main-content" className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {settings && <SettingsPanel onClose={() => setSettings(false)} />}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-indigo-400" />
              Market Intelligence
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Feed
              </span>
              <span>·</span>
              <span>39 Active Instruments</span>
            </div>
          </div>
          <button className="button-secondary" onClick={refresh} disabled={market.loading}>
            <RefreshCw className={`h-4 w-4 ${market.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {market.error && <ErrorNotice message={market.error} onRetry={market.refresh} />}

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6">
          {tab !== 'news' &&
            panels
              .filter(
                (p) =>
                  tab === 'overview' ||
                  (tab === 'equities' && ['us', 'india'].includes(p.category)) ||
                  (tab === 'crypto' && p.category === 'crypto') ||
                  (tab === 'commodities' && ['commodities', 'forex'].includes(p.category))
              )
              .map((panel) => (
                <MarketPanel
                  key={panel.category}
                  title={panel.title}
                  description={panel.description}
                  quotes={quotes.filter((q) => q.category === panel.category)}
                  loading={market.loading}
                  onSelect={select}
                  sectors={panel.category === 'india'}
                  layout={['crypto', 'commodities', 'forex'].includes(panel.category) ? 'cards' : 'table'}
                />
              ))}

          {(tab === 'news' || tab === 'overview') && (
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
          )}

          {(tab === 'news' || tab === 'overview') && <ScenarioSimulator />}
        </div>
      </main>

      <footer className="mx-auto max-w-[1440px] border-t border-slate-800/80 px-6 py-6 text-center text-xs leading-relaxed text-slate-500">
        AI market insights are informational and do not constitute financial advice. Always verify quotes independently.
      </footer>

      {current && (
        <Suspense fallback={<Loading label="Loading asset details…" />}>
          <AssetDetail
            key={current.symbol}
            quote={current}
            onClose={() => setSelected(null)}
            engine={engine}
            onEngine={setEngine}
            entry={ai.entries[analysisKey(`asset:${current.symbol}`, engine)]}
            onAnalyze={() =>
              void ai.run(
                `asset:${current.symbol}`,
                `Assess the available market evidence for ${current.name} (${current.symbol}).`,
                engine,
                current.symbol
              )
            }
          />
        </Suspense>
      )}
    </div>
  );
}
