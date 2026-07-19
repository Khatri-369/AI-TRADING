import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import TickerTape from './components/TickerTape';
import SettingsPanel from './components/SettingsPanel';
import USStockPanel from './components/USStockPanel';
import CommoditiesPanel from './components/CommoditiesPanel';
import CryptoPanel from './components/CryptoPanel';
import IndianEquityPanel from './components/IndianEquityPanel';
import NewsSignalFeed from './components/NewsSignalFeed';
import DealsFlowMap from './components/DealsFlowMap';
import SignalSummaryDashboard from './components/SignalSummaryDashboard';
import Footer from './components/Footer';
import ScenarioSimulator from './components/ScenarioSimulator';

import { ThemeType, LivePrice, NewsItem, AISignal } from './types/market';
import { THEMES } from './utils/themes';

// Pre-seeded high-fidelity financial headlines to fall back on when Finnhub API Key is not set
const PRE_SEEDED_NEWS_STORIES = [
  {
    headline: "Federal Reserve hints at tapering rate-hike pace as inflation markers contract",
    source: "Bloomberg",
    region: "US",
    affected_assets: ["SPY", "USD/INR", "Gold"]
  },
  {
    headline: "Gold prices cross record nominal highs as global central banks accelerate gold reserve buying",
    source: "Reuters",
    region: "Global",
    affected_assets: ["Gold", "Silver"]
  },
  {
    headline: "Bitcoin sovereign accumulation surges as institutional spot ETFs log consecutive inflows",
    source: "Coindesk",
    region: "Crypto",
    affected_assets: ["BTC", "ETH"]
  },
  {
    headline: "Nvidia logs blowout corporate earnings on monumental hyperscaler AI processing demand",
    source: "Financial Times",
    region: "US",
    affected_assets: ["NVDA", "AAPL", "MSFT"]
  },
  {
    headline: "USD strengthens against emerging markets currencies ahead of treasury liquidity injection",
    source: "Wall Street Journal",
    region: "Forex",
    affected_assets: ["USD/INR", "Nifty"]
  },
  {
    headline: "Ethereum core developers finalize protocol upgrades targeting Layer-2 network fee efficiency",
    source: "TechCrunch",
    region: "Crypto",
    affected_assets: ["ETH", "BNB"]
  },
  {
    headline: "Indian monsoon logs favorable distribution, lifting rural consumption forecasts for FMCG indices",
    source: "Economic Times",
    region: "IN",
    affected_assets: ["Nifty", "ITC"]
  },
  {
    headline: "Silver spot trades highly correlated with gold amidst rising industrial photovoltaic fabrication demand",
    source: "Miners Bulletin",
    region: "Commodities",
    affected_assets: ["Silver", "Gold"]
  },
  {
    headline: "Tesla announces regulatory approvals for advanced autonomous navigation modules in China",
    source: "Nikkei",
    region: "US",
    affected_assets: ["TSLA", "CN"]
  },
  {
    headline: "Sovereign gold reserves repatriation logs double-digit growth amongst major European central banks",
    source: "EuroNews",
    region: "Europe",
    affected_assets: ["Gold", "Silver"]
  }
];

export default function App() {
  const [theme, setTheme] = useState<ThemeType>('midnight');
  const [activeTab, setActiveTab] = useState<'overview' | 'equities' | 'commodities' | 'crypto' | 'news'>('overview');
  const [finnhubKey, setFinnhubKey] = useState<string>('');
  const [goldApiKey, setGoldApiKey] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [newsEngine, setNewsEngine] = useState<'gemini' | 'finbert'>('finbert');
  
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  
  // Connection and live state indicators
  const [stats, setStats] = useState({
    crypto: 'loading' as 'live' | 'simulated' | 'loading' | 'error',
    usStocks: 'simulated' as 'live' | 'simulated' | 'loading' | 'error',
    commodities: 'simulated' as 'live' | 'simulated' | 'loading' | 'error',
    news: 'simulated' as 'live' | 'simulated' | 'loading' | 'error',
    indianEquity: 'disconnected' as const,
    gemini: 'active' as 'active' | 'demo' | 'error'
  });

  // Prices and quote lists
  const [prices, setPrices] = useState<LivePrice[]>([]);
  const [usdInrRate, setUsdInrRate] = useState<number>(83.45);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isUpdatingTicker, setIsUpdatingTicker] = useState<boolean>(false);

  // Gemini Signal cache states
  const [isAnalyzing, setIsAnalyzing] = useState<Record<string, boolean>>({});
  const [analysisData, setAnalysisData] = useState<Record<string, any>>({});
  const analysisDataRef = useRef(analysisData);
  analysisDataRef.current = analysisData;

  // Refs for tracking API polling and active analysis dispatches
  const initiatedAnalysis = useRef<Set<string>>(new Set());
  const prevFinnhubKey = useRef<string>('');
  const prevGoldKey = useRef<string>('');

  const colors = THEMES[theme];

  // 1. Core Data Initializer
  useEffect(() => {
    // Bootstrap initial data skeleton
    const initialPrices: LivePrice[] = [
      { symbol: 'BTC', name: 'Bitcoin', priceUSD: 64250, priceINR: 5364875, changePercent: 1.85, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'ETH', name: 'Ethereum', priceUSD: 3420, priceINR: 285570, changePercent: -0.45, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'BNB', name: 'BNB Chain', priceUSD: 585, priceINR: 48847, changePercent: 0.25, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'SOL', name: 'Solana', priceUSD: 145.50, priceINR: 12149, changePercent: 4.15, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'XRP', name: 'Ripple', priceUSD: 0.585, priceINR: 48.84, changePercent: -1.12, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'XAU', name: 'Gold Bullion', priceUSD: 2320.45, priceINR: 62450, changePercent: 0.15, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'XAG', name: 'Silver Bullion', priceUSD: 29.12, priceINR: 78120, changePercent: 0.85, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'USD/INR', name: 'USD to INR FX', priceUSD: 0, priceINR: 83.45, changePercent: 0.05, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'AAPL', name: 'Apple Inc.', priceUSD: 178.45, priceINR: 14890, changePercent: 0.65, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', priceUSD: 415.60, priceINR: 34680, changePercent: -0.35, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', priceUSD: 875.12, priceINR: 73020, changePercent: 5.42, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'TSLA', name: 'Tesla Inc.', priceUSD: 171.05, priceINR: 14275, changePercent: -2.15, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', priceUSD: 180.15, priceINR: 15033, changePercent: 1.10, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', priceUSD: 152.30, priceINR: 12710, changePercent: 0.95, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'META', name: 'Meta Platforms Inc.', priceUSD: 495.80, priceINR: 41370, changePercent: -1.55, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'SPY', name: 'S&P 500 (SPY)', priceUSD: 512.45, priceINR: 42764, changePercent: 0.35, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'NIFTY50', name: 'NSE Nifty 50', priceUSD: 0, priceINR: 22450, changePercent: 0.45, lastUpdated: new Date(), status: 'loading' },
      { symbol: 'SENSEX', name: 'BSE Sensex', priceUSD: 0, priceINR: 73850, changePercent: 0.42, lastUpdated: new Date(), status: 'loading' }
    ];

    setPrices(initialPrices);

    // Bootstrap initial news stories from preseeded ones
    const bootstrapNews: NewsItem[] = PRE_SEEDED_NEWS_STORIES.map((story, i) => ({
      id: `story-pre-${i}`,
      headline: story.headline,
      source: story.source,
      datetime: new Date(Date.now() - i * 60 * 60 * 1000), // Stagger times back hourly
      region: story.region,
      affected_assets: story.affected_assets
    }));

    setNews(bootstrapNews);
    
    // Trigger initial fetch loops
    fetchMarketData();
    triggerPriceFetchLoop();
  }, []);

  // 2. Multi-Engine Sentiment Analysis Hook (Gemini and FinBERT support)
  const analyzeHeadlineOrAsset = async (itemId: string, headlineText: string, priceContextObj?: any, engineOverride?: 'gemini' | 'finbert') => {
    const activeEngine = engineOverride || newsEngine;
    const cacheKey = `${itemId}_${activeEngine}`;
    
    // Mark as analyzing
    setIsAnalyzing(prev => ({ ...prev, [cacheKey]: true }));
    initiatedAnalysis.current.add(cacheKey);

    try {
      const response = await fetch('/api/analyze-headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headlineText,
          priceContext: priceContextObj,
          engine: activeEngine
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reach server analysis proxy');
      }

      const signal: AISignal = await response.json();
      signal.timestamp = new Date();
      
      // Cache returned analysis in state with engine key
      setAnalysisData(prev => ({ 
        ...prev, 
        [itemId]: signal,
        [cacheKey]: signal
      }));
      
      // Update news feed array with mapped analysis if it corresponds to a news headline
      setNews(prevNews => prevNews.map(item => {
        if (item.id === itemId) {
          return { ...item, analysis: signal, isAnalyzing: false };
        }
        return item;
      }));

    } catch (err) {
      console.error('Error conducting news analysis:', err);
      // Fallback stub analysis gracefully so it never crashes
      const fallbackSignal: AISignal = {
        sentiment: 'Neutral',
        signal: 'Hold',
        confidence: 60,
        rationale: 'Unable to connect to model. Standard hedging index recommended.',
        affected_assets: ['Index'],
        timestamp: new Date(),
        engine: activeEngine
      };
      setAnalysisData(prev => ({ 
        ...prev, 
        [itemId]: fallbackSignal,
        [cacheKey]: fallbackSignal
      }));
      setNews(prevNews => prevNews.map(item => {
        if (item.id === itemId) {
          return { ...item, analysis: fallbackSignal, isAnalyzing: false };
        }
        return item;
      }));
    } finally {
      setIsAnalyzing(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

  // Trigger automated Multi-Engine analysis for ALL news items for the currently active engine
  useEffect(() => {
    if (news.length === 0) return;

    // Filter items that don't have a cached analysis for the current newsEngine and aren't already being analyzed
    const unanalyzed = news.filter(item => {
      const cacheKey = `${item.id}_${newsEngine}`;
      return !analysisDataRef.current[cacheKey] && !initiatedAnalysis.current.has(cacheKey);
    });

    if (unanalyzed.length === 0) return;

    // Register active dispatches in the ref immediately to avoid duplicate triggers
    unanalyzed.forEach(item => {
      const cacheKey = `${item.id}_${newsEngine}`;
      initiatedAnalysis.current.add(cacheKey);
    });

    // Analyze all unanalyzed items, staggered slightly to prevent concurrent request slamming and look visually awesome
    const timers = unanalyzed.map((item, index) => {
      return setTimeout(() => {
        analyzeHeadlineOrAsset(item.id, item.headline, undefined, newsEngine);
      }, index * 400); // Stagger by 400ms so they analyze one by one elegantly!
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [news.map(item => item.id).join(','), newsEngine]);

  // 3. Consolidated Fast Cached Market Data Fetching (Server Proxy with 20s Caching)
  const fetchMarketData = async () => {
    setStats(prev => ({ ...prev, crypto: 'loading' }));
    try {
      const response = await fetch('/api/market-prices');
      if (!response.ok) {
        throw new Error('Failed to fetch consolidated market data');
      }
      const data = await response.json();
      
      // Update exchange rate
      const forex = data.forex || 83.45;
      setUsdInrRate(forex);

      // Update crypto prices
      setPrices((prev) =>
        prev.map((item) => {
          // 1. Update FX Rate itself
          if (item.symbol === 'USD/INR') {
            return {
              ...item,
              priceINR: forex,
              lastUpdated: new Date(),
              status: data.source.includes('live') ? 'live' : 'simulated'
            };
          }

          // 2. Update Crypto assets
          let geckoId = '';
          if (item.symbol === 'BTC') geckoId = 'bitcoin';
          else if (item.symbol === 'ETH') geckoId = 'ethereum';
          else if (item.symbol === 'BNB') geckoId = 'binancecoin';
          else if (item.symbol === 'SOL') geckoId = 'solana';
          else if (item.symbol === 'XRP') geckoId = 'ripple';

          if (geckoId && data.crypto && data.crypto[geckoId]) {
            const usd = data.crypto[geckoId].usd;
            const inr = data.crypto[geckoId].inr;
            const change = data.crypto[geckoId].usd_24h_change || 0;
            return {
              ...item,
              priceUSD: usd,
              priceINR: inr,
              changePercent: change,
              lastUpdated: new Date(),
              status: data.source.includes('live') ? 'live' : 'simulated'
            };
          }

          // Update other assets using fresh exchange rate
          if (['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY'].includes(item.symbol)) {
            return {
              ...item,
              priceINR: item.priceUSD * forex
            };
          }

          return item;
        })
      );

      setStats(prev => ({ ...prev, crypto: data.source.includes('live') ? 'live' : 'simulated' }));
    } catch (err) {
      console.warn('Server proxy failed, applying high-fidelity client-side drift fallback:', err);
      // Client-side drift fallback for Crypto and Forex
      setPrices((prev) =>
        prev.map((item) => {
          const isCrypto = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'].includes(item.symbol);
          if (isCrypto) {
            const noise = (Math.random() - 0.5) * 0.4;
            const priceUSD = item.priceUSD * (1 + noise / 100);
            return {
              ...item,
              priceUSD,
              priceINR: priceUSD * usdInrRate,
              changePercent: item.changePercent + noise,
              lastUpdated: new Date(),
              status: 'simulated'
            };
          }
          if (item.symbol === 'USD/INR') {
            const drift = (Math.random() - 0.5) * 0.05;
            const nextRate = parseFloat((usdInrRate + drift).toFixed(4));
            return {
              ...item,
              priceINR: nextRate,
              changePercent: drift * 100,
              lastUpdated: new Date(),
              status: 'simulated'
            };
          }
          return item;
        })
      );
      setStats(prev => ({ ...prev, crypto: 'simulated' }));
    }
  };

  // 4. Live US Stocks Fetching (Finnhub)
  const fetchUSStockPrices = async () => {
    if (!finnhubKey) {
      setStats(prev => ({ ...prev, usStocks: 'simulated' }));
      return;
    }

    setStats(prev => ({ ...prev, usStocks: 'loading' }));

    const stockSymbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY'];
    let fetchedCount = 0;

    for (const symbol of stockSymbols) {
      try {
        // Pause/stagger requests to remain within Finnhub's free limit of 60 calls/min
        await new Promise((resolve) => setTimeout(resolve, 800));

        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
        if (!response.ok) throw new Error(`Stock ${symbol} failed`);

        const data = await response.json();
        if (data.c) {
          setPrices((prev) =>
            prev.map((item) => {
              if (item.symbol === symbol) {
                const currentPrice = data.c;
                const change = data.dp || 0;
                return {
                  ...item,
                  priceUSD: currentPrice,
                  priceINR: currentPrice * usdInrRate,
                  changePercent: change,
                  high: data.h,
                  low: data.l,
                  lastUpdated: new Date(),
                  status: 'live'
                };
              }
              return item;
            })
          );
          fetchedCount++;
        }
      } catch (err) {
        console.error(`Finnhub quote fail for ${symbol}:`, err);
      }
    }

    setStats(prev => ({
      ...prev,
      usStocks: fetchedCount > 0 ? 'live' : 'error'
    }));
  };

  // 5. Live Gold & Silver Fetching (GoldAPI.io)
  const fetchCommodities = async () => {
    if (!goldApiKey) {
      setStats(prev => ({ ...prev, commodities: 'simulated' }));
      return;
    }

    setStats(prev => ({ ...prev, commodities: 'loading' }));

    try {
      // Gold spot
      const goldRes = await fetch('https://www.goldapi.io/api/XAU/USD', {
        headers: { 'x-access-token': goldApiKey }
      });
      const goldData = await goldRes.json();

      // Silver spot
      await new Promise(r => setTimeout(r, 1000)); // Rate limit buffer
      const silverRes = await fetch('https://www.goldapi.io/api/XAG/USD', {
        headers: { 'x-access-token': goldApiKey }
      });
      const silverData = await silverRes.json();

      setPrices((prev) =>
        prev.map((item) => {
          if (item.symbol === 'XAU' && goldData.price) {
            return {
              ...item,
              priceUSD: goldData.price,
              changePercent: goldData.chg_pct || 0,
              lastUpdated: new Date(),
              status: 'live'
            };
          }
          if (item.symbol === 'XAG' && silverData.price) {
            return {
              ...item,
              priceUSD: silverData.price,
              changePercent: silverData.chg_pct || 0,
              lastUpdated: new Date(),
              status: 'live'
            };
          }
          return item;
        })
      );

      setStats(prev => ({ ...prev, commodities: 'live' }));
    } catch (err) {
      console.error('GoldAPI fetching failed, deploying simulated drift:', err);
      setStats(prev => ({ ...prev, commodities: 'error' }));
    }
  };

  // 6. Live FX Forex Rate Fetching (Finnhub or Fallback)
  const fetchForexRate = async () => {
    try {
      const response = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR');
      if (response.ok) {
        const data = await response.json();
        if (data.rates && data.rates.INR) {
          setUsdInrRate(data.rates.INR);
          setPrices(prev => prev.map(item => {
            if (item.symbol === 'USD/INR') {
              return { ...item, priceINR: data.rates.INR, lastUpdated: new Date(), status: 'live' };
            }
            return item;
          }));
          return;
        }
      }
    } catch (e) {
      console.warn('Alternative Forex source selected.');
    }

    // Default stable exchange rate drift
    const drift = (Math.random() - 0.5) * 0.05;
    const finalRate = parseFloat((usdInrRate + drift).toFixed(4));
    setUsdInrRate(finalRate);
    setPrices(prev => prev.map(item => {
      if (item.symbol === 'USD/INR') {
        return { ...item, priceINR: finalRate, changePercent: drift * 100, lastUpdated: new Date(), status: 'simulated' };
      }
      return item;
    }));
  };

  // 7. Live Market News Fetching (Finnhub)
  const fetchFinnhubNews = async () => {
    if (!finnhubKey) {
      setStats(prev => ({ ...prev, news: 'simulated' }));
      return;
    }

    setStats(prev => ({ ...prev, news: 'loading' }));

    try {
      const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`);
      if (!response.ok) throw new Error('News query failed');

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const filteredStories: NewsItem[] = data.slice(0, 10).map((article: any, idx: number) => {
          // Identify keyword tags automatically from the story headline text
          const headlineLower = article.headline.toLowerCase();
          const tags: string[] = [];
          if (headlineLower.includes('bitcoin') || headlineLower.includes('crypto') || headlineLower.includes('btc')) tags.push('BTC');
          if (headlineLower.includes('ethereum') || headlineLower.includes('eth')) tags.push('ETH');
          if (headlineLower.includes('nvidia') || headlineLower.includes('gpu')) tags.push('NVDA');
          if (headlineLower.includes('gold') || headlineLower.includes('bullion')) tags.push('Gold');
          if (headlineLower.includes('silver') || headlineLower.includes('photovoltaic')) tags.push('Silver');
          if (headlineLower.includes('apple') || headlineLower.includes('iphone')) tags.push('AAPL');
          if (headlineLower.includes('tesla') || headlineLower.includes('musk')) tags.push('TSLA');
          if (tags.length === 0) tags.push('Global Markets');

          return {
            id: `story-live-${article.id || idx}`,
            headline: article.headline,
            source: article.source || 'Finnhub',
            datetime: new Date(article.datetime * 1000),
            region: 'Global',
            affected_assets: tags
          };
        });

        setNews(filteredStories);
        setStats(prev => ({ ...prev, news: 'live' }));
      }
    } catch (err) {
      console.error('Finnhub news fetching failed:', err);
      setStats(prev => ({ ...prev, news: 'error' }));
    }
  };

  // 8. Polling Trigger Logic
  const triggerPriceFetchLoop = () => {
    // Poll CoinGecko Crypto every 30 seconds
    const cryptoInterval = setInterval(() => {
      fetchMarketData();
    }, 30000);

    // Dynamic price and index simulation/drift every 5 seconds (keeps the screen real-time and alive!)
    const simulatedDriftInterval = setInterval(() => {
      setLastUpdated(new Date());

      const today = new Date();
      const isWeekend = today.getDay() === 0 || today.getDay() === 6;

      setPrices((prev) =>
        prev.map((item) => {
          // Only drift items if their current connection stat is simulated
          const isCryptoSim = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'].includes(item.symbol) && stats.crypto !== 'live';
          const isStockSim = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY'].includes(item.symbol) && stats.usStocks !== 'live';
          const isCommSim = ['XAU', 'XAG'].includes(item.symbol) && stats.commodities !== 'live';
          const isIndices = ['NIFTY50', 'SENSEX'].includes(item.symbol);

          // If weekend, non-crypto assets are closed
          if (isWeekend && (isStockSim || isCommSim || isIndices)) {
            return {
              ...item,
              lastUpdated: new Date()
            };
          }

          if (isCryptoSim || isStockSim || isCommSim || isIndices) {
            const noise = (Math.random() - 0.5) * 0.15;
            const priceUSD = item.priceUSD * (1 + noise / 100);
            const priceINR = item.priceINR * (1 + noise / 100);
            return {
              ...item,
              priceUSD,
              priceINR,
              changePercent: item.changePercent + noise,
              lastUpdated: new Date()
            };
          }
          return item;
        })
      );
    }, 5000);

    return () => {
      clearInterval(cryptoInterval);
      clearInterval(simulatedDriftInterval);
    };
  };

  // 9. Interactive Scenario Shock Ingestion
  const handleInjectShock = (impacts: Record<string, number>) => {
    setPrices((prev) =>
      prev.map((item) => {
        if (impacts[item.symbol] !== undefined) {
          const percentChange = impacts[item.symbol];
          const priceUSD = item.priceUSD * (1 + percentChange / 100);
          const priceINR = item.priceINR * (1 + percentChange / 100);
          return {
            ...item,
            priceUSD,
            priceINR,
            changePercent: item.changePercent + percentChange,
            lastUpdated: new Date()
          };
        }
        return item;
      })
    );
  };

  // 10. API State triggers based on API key state changes
  useEffect(() => {
    if (finnhubKey && finnhubKey !== prevFinnhubKey.current) {
      prevFinnhubKey.current = finnhubKey;
      fetchUSStockPrices();
      fetchFinnhubNews();
    }
  }, [finnhubKey]);

  useEffect(() => {
    if (goldApiKey && goldApiKey !== prevGoldKey.current) {
      prevGoldKey.current = goldApiKey;
      fetchCommodities();
    }
  }, [goldApiKey]);

  // Combine and consolidate all generated AI ratings currently loaded in state
  const getAIRecommendations = () => {
    const list: Array<{
      symbol: string;
      asset: string;
      signal: 'Buy' | 'Sell' | 'Hold';
      confidence: number;
      rationale: string;
      type: 'Stock' | 'Crypto' | 'Commodity' | 'News';
    }> = [];

    // Parse stock analysis
    Object.entries(analysisData).forEach(([symbol, rawSignal]) => {
      const signal = rawSignal as any;
      const match = prices.find(p => p.symbol === symbol);
      if (match) {
        list.push({
          symbol,
          asset: match.name,
          signal: signal.signal,
          confidence: signal.confidence,
          rationale: signal.rationale,
          type: ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'].includes(symbol) ? 'Crypto' : ['XAU', 'XAG'].includes(symbol) ? 'Commodity' : 'Stock'
        });
      }
    });

    // Parse news stories analysis dynamically based on the active engine
    news.forEach((n) => {
      const cacheKey = `${n.id}_${newsEngine}`;
      const activeAnalysis = analysisData[cacheKey] || null;
      if (activeAnalysis) {
        list.push({
          symbol: n.affected_assets[0] || 'Global',
          asset: n.headline.slice(0, 20) + '...',
          signal: activeAnalysis.signal,
          confidence: activeAnalysis.confidence,
          rationale: activeAnalysis.rationale,
          type: 'News'
        });
      }
    });

    return list;
  };

  // Search filter across assets
  const filteredPrices = prices.filter((price) => {
    if (!searchTerm) return true;
    return (
      price.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      price.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className={`min-h-screen pb-12 transition-all duration-300 select-none ${colors.fontFamily} ${colors.bg}`}>
      
      {/* 1. Global Navigation Header */}
      <Header
        currentTheme={theme}
        setTheme={setTheme}
        colors={colors}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSettingsOpen={isSettingsOpen}
        toggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        lastUpdated={lastUpdated}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* 2. Scrolling Ticker Marquee Strip */}
      <TickerTape
        prices={filteredPrices}
        colors={colors}
        onRefresh={() => {
          fetchMarketData();
          if (finnhubKey) {
            fetchUSStockPrices();
            fetchFinnhubNews();
          }
          if (goldApiKey) {
            fetchCommodities();
          }
        }}
        isUpdating={isUpdatingTicker}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Collapsible Key Config Panel */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          finnhubKey={finnhubKey}
          setFinnhubKey={setFinnhubKey}
          goldApiKey={goldApiKey}
          setGoldApiKey={setGoldApiKey}
          colors={colors}
          stats={stats}
        />

        <div className="grid grid-cols-1 gap-10">
          
          {/* Overview Tab (Cockpit) */}
          {activeTab === 'overview' && (
            <>
              {/* Market Vital Signs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                {/* SPY */}
                <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} flex flex-col justify-between h-32 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex justify-between items-start text-sm text-slate-400">
                    <span className="font-extrabold tracking-widest font-mono uppercase">US Market (SPY)</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                      isWeekend
                        ? 'text-slate-400 bg-slate-900 border-slate-800'
                        : (prices.find(p => p.symbol === 'SPY')?.changePercent || 0) >= 0 
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    }`}>
                      {isWeekend ? (
                        'CLOSED'
                      ) : (
                        <>
                          {(prices.find(p => p.symbol === 'SPY')?.changePercent || 0) >= 0 ? '+' : ''}
                          {(prices.find(p => p.symbol === 'SPY')?.changePercent || 0).toFixed(2)}%
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black text-white font-mono">
                      ${(prices.find(p => p.symbol === 'SPY')?.priceUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-500 block font-bold font-mono mt-1">
                      INR {(prices.find(p => p.symbol === 'SPY')?.priceINR || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* BTC */}
                <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} flex flex-col justify-between h-32 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex justify-between items-start text-sm text-slate-400">
                    <span className="font-extrabold tracking-widest font-mono uppercase">Crypto (BTC)</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                      (prices.find(p => p.symbol === 'BTC')?.changePercent || 0) >= 0 
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    }`}>
                      {(prices.find(p => p.symbol === 'BTC')?.changePercent || 0) >= 0 ? '+' : ''}
                      {(prices.find(p => p.symbol === 'BTC')?.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black text-white font-mono">
                      ${(prices.find(p => p.symbol === 'BTC')?.priceUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-500 block font-bold font-mono mt-1">
                      INR {(prices.find(p => p.symbol === 'BTC')?.priceINR || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Gold */}
                <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} flex flex-col justify-between h-32 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex justify-between items-start text-sm text-slate-400">
                    <span className="font-extrabold tracking-widest font-mono uppercase">Spot Gold (XAU)</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                      isWeekend
                        ? 'text-slate-400 bg-slate-900 border-slate-800'
                        : (prices.find(p => p.symbol === 'XAU')?.changePercent || 0) >= 0 
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    }`}>
                      {isWeekend ? (
                        'CLOSED'
                      ) : (
                        <>
                          {(prices.find(p => p.symbol === 'XAU')?.changePercent || 0) >= 0 ? '+' : ''}
                          {(prices.find(p => p.symbol === 'XAU')?.changePercent || 0).toFixed(2)}%
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black text-white font-mono">
                      ${(prices.find(p => p.symbol === 'XAU')?.priceUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-500 block font-bold font-mono mt-1">
                      INR {(prices.find(p => p.symbol === 'XAU')?.priceINR || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 10g
                    </span>
                  </div>
                </div>

                {/* NIFTY 50 */}
                <div className={`p-6 rounded-2xl border ${colors.border} ${colors.cardBg} flex flex-col justify-between h-32 relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex justify-between items-start text-sm text-slate-400">
                    <span className="font-extrabold tracking-widest font-mono uppercase">NIFTY50 Benchmark</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                      isWeekend
                        ? 'text-slate-400 bg-slate-900 border-slate-800'
                        : (prices.find(p => p.symbol === 'NIFTY50')?.changePercent || 0) >= 0 
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    }`}>
                      {isWeekend ? (
                        'CLOSED'
                      ) : (
                        <>
                          {(prices.find(p => p.symbol === 'NIFTY50')?.changePercent || 0) >= 0 ? '+' : ''}
                          {(prices.find(p => p.symbol === 'NIFTY50')?.changePercent || 0).toFixed(2)}%
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black text-white font-mono">
                      ₹{(prices.find(p => p.symbol === 'NIFTY50')?.priceINR || 22450).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xs text-slate-500 block font-bold font-mono mt-1">
                      NSE Indian Index
                    </span>
                  </div>
                </div>
              </div>

              {/* Overall Summary with Pie distribution */}
              <SignalSummaryDashboard
                colors={colors}
                signals={getAIRecommendations()}
              />

              {/* Scenario Lab: Macro Headline Simulator */}
              <ScenarioSimulator
                colors={colors}
                activeEngine={newsEngine}
                onEngineChange={setNewsEngine}
                onInjectShock={handleInjectShock}
              />

              {/* World trade deals and flow map */}
              <DealsFlowMap colors={colors} />
            </>
          )}

          {/* Equities Tab */}
          {activeTab === 'equities' && (
            <div className="w-full">
              <div className="flex overflow-x-auto gap-6 pb-6 pt-2 scrollbar-thin snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
                
                {/* Panel 1: US Tech Equities */}
                <div className="min-w-[340px] sm:min-w-[550px] lg:min-w-[700px] xl:min-w-[800px] max-w-[95%] flex-1 snap-start">
                  <USStockPanel
                    stocks={filteredPrices.filter(p => ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'].includes(p.symbol))}
                    colors={colors}
                    apiKeyMissing={!finnhubKey}
                    onAnalyze={(symbol) => {
                      const item = prices.find(p => p.symbol === symbol);
                      analyzeHeadlineOrAsset(symbol, `Analyze price momentum of ${symbol} stock. Current price is $${item?.priceUSD || 0}`, item);
                    }}
                    isAnalyzing={isAnalyzing}
                    analysisData={analysisData}
                  />
                </div>

                {/* Panel 2: NSE Indian Equities */}
                <div className="min-w-[340px] sm:min-w-[550px] lg:min-w-[700px] xl:min-w-[800px] max-w-[95%] flex-1 snap-start">
                  <IndianEquityPanel colors={colors} />
                </div>

                {/* Panel 3: Commodities Spot Bullions */}
                <div className="min-w-[340px] sm:min-w-[550px] lg:min-w-[700px] xl:min-w-[800px] max-w-[95%] flex-1 snap-start">
                  <CommoditiesPanel
                    gold={prices.find(p => p.symbol === 'XAU') || null}
                    silver={prices.find(p => p.symbol === 'XAG') || null}
                    usdInrRate={usdInrRate}
                    colors={colors}
                    apiKeyMissing={!goldApiKey}
                    onAnalyze={(symbol) => {
                      const item = prices.find(p => p.symbol === symbol);
                      analyzeHeadlineOrAsset(symbol, `Analyze Spot pricing behavior of bullion commodity ${symbol}. Current rate: $${item?.priceUSD} per Troy oz.`, item);
                    }}
                    isAnalyzing={isAnalyzing}
                    analysisData={analysisData}
                  />
                </div>

              </div>
              <div className="flex justify-center gap-1.5 text-xs text-slate-500 font-medium items-center py-2 animate-pulse">
                <span>← Swipe or scroll horizontally to view other markets (US Tech, NSE India, Commodities) →</span>
              </div>
            </div>
          )}

          {/* Commodities Tab */}
          {activeTab === 'commodities' && (
            <CommoditiesPanel
              gold={prices.find(p => p.symbol === 'XAU') || null}
              silver={prices.find(p => p.symbol === 'XAG') || null}
              usdInrRate={usdInrRate}
              colors={colors}
              apiKeyMissing={!goldApiKey}
              onAnalyze={(symbol) => {
                const item = prices.find(p => p.symbol === symbol);
                analyzeHeadlineOrAsset(symbol, `Analyze Spot pricing behavior of bullion commodity ${symbol}. Current rate: $${item?.priceUSD} per Troy oz.`, item);
              }}
              isAnalyzing={isAnalyzing}
              analysisData={analysisData}
            />
          )}

          {/* Crypto Tab */}
          {activeTab === 'crypto' && (
            <CryptoPanel
              cryptoPrices={filteredPrices.filter(p => ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'].includes(p.symbol))}
              colors={colors}
              onAnalyze={(symbol) => {
                const item = prices.find(p => p.symbol === symbol);
                analyzeHeadlineOrAsset(symbol, `Analyze structural breakout index of cryptocurrency asset ${symbol}. Current trade rate is $${item?.priceUSD}`, item);
              }}
              isAnalyzing={isAnalyzing}
              analysisData={analysisData}
            />
          )}

          {/* News & Signals Tab */}
          {activeTab === 'news' && (
            <NewsSignalFeed
              news={news.map(item => {
                const cacheKey = `${item.id}_${newsEngine}`;
                return {
                  ...item,
                  analysis: analysisData[cacheKey] || null,
                  isAnalyzing: isAnalyzing[cacheKey] || false
                };
              })}
              colors={colors}
              apiKeyMissing={!finnhubKey}
              onAnalyzeHeadline={(id, engine) => {
                const story = news.find(n => n.id === id);
                if (story) {
                  const targetEngine = engine || newsEngine;
                  const cacheKey = `${id}_${targetEngine}`;
                  initiatedAnalysis.current.delete(cacheKey);
                  analyzeHeadlineOrAsset(id, story.headline, undefined, targetEngine);
                }
              }}
              isLoading={stats.news === 'loading'}
              activeEngine={newsEngine}
              onEngineChange={setNewsEngine}
            />
          )}

        </div>
      </main>

      {/* 10. Comprehensive Footer */}
      <Footer colors={colors} />

    </div>
  );
}
