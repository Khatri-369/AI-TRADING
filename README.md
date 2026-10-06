<div align="center">

# 🌍 Global Markets Command Center

**Production-Quality Real-Data Financial Market Intelligence Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node: >=22](https://img.shields.io/badge/Node->=22.14-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-28%20Passing-success.svg)](https://nodejs.org/api/test.html)

A professional, audit-grade market intelligence application combining genuine real-time financial market feeds with server-side AI sentiment reasoning and scenario simulation. No synthetic prices, fabricated volumes, or mock news headlines.

</div>

---

## 🏛️ System Architecture

The application is structured into decoupled, maintainable layers:

```
AI TRADING/
├── server/                      # Production Express backend
│   ├── app.ts                  # Route definitions, rate limiting, and security headers
│   ├── config.ts               # Environment validation & secrets hygiene
│   ├── ai/                     # Multi-engine AI analysis pipelines
│   │   ├── index.ts            # Gemini & FinBERT dispatchers
│   │   ├── schemas.ts          # Zod validation schemas for AI responses
│   │   ├── cache.ts            # LRU cache for inference deduplication
│   │   └── ai.test.ts          # Automated unit & contract tests for AI
│   ├── market/                 # Real market data providers & feeds
│   │   ├── index.ts            # Consolidated MarketService orchestrator
│   │   ├── providers.ts        # Finnhub, CoinGecko, Frankfurter, Upstox, GoldAPI
│   │   ├── websocket.ts        # Upstox V3 Market Data Feed WebSocket client
│   │   ├── MarketDataFeed.proto# Protocol Buffer schema for Upstox feed
│   │   ├── sessions.ts         # NYSE / NSE / BSE market clocks & holiday schedules
│   │   ├── cache.ts            # Bounded LRU cache with stale-while-revalidate
│   │   └── http.ts             # Safe fetcher with timeouts, sanitization, and parsing
│   └── tests/                  # Integration tests
│       └── app.test.ts         # Server contract, security & health tests
├── shared/                     # Universally shared domain definitions
│   ├── assets.ts               # Tracked equities, indices, crypto, forex, commodities
│   └── types.ts                # TypeScript interfaces shared between frontend & backend
├── src/                        # Modern React frontend
│   ├── components/             # Focused UI components
│   │   ├── Header.tsx          # Navigation, clock, search & theme controls
│   │   ├── TickerTape.tsx      # High-performance ticker marquee
│   │   ├── MarketPanel.tsx     # Filterable quote tables and cards
│   │   ├── QuoteCard.tsx       # Individual asset card with status badge
│   │   ├── AssetDetail.tsx     # Comprehensive deep-dive drawer with interactive charts
│   │   ├── NewsSignalFeed.tsx  # Genuine financial news with AI sentiment badges
│   │   ├── ScenarioSimulator.tsx # Hypothetical macro event impact simulator
│   │   ├── SettingsPanel.tsx   # Live provider connectivity and status dashboard
│   │   ├── StatusBadge.tsx     # Visual indicator of data freshness
│   │   └── Feedback.tsx        # Accessible loading skeletons and error states
│   ├── hooks/                  # Clean data-fetching and polling hooks
│   │   ├── useMarketData.ts    # Polling & cache hook for quotes and news
│   │   ├── useAIAnalysis.ts    # On-demand AI inference trigger with local caching
│   │   └── usePolling.ts       # Tab-visibility-aware polling manager
│   ├── services/
│   │   └── api.ts              # Strongly typed backend API client
│   ├── utils/
│   │   ├── format.ts           # Number, currency, and date formatting
│   │   └── themes.ts           # Sleek financial terminal color themes
│   ├── types/
│   │   └── market.ts           # Frontend component types
│   ├── App.tsx                 # Root dashboard layout & error boundaries
│   └── index.css               # Design system & utility classes
├── server.ts                   # Application entrypoint (Vite middleware in dev, static in prod)
├── Dockerfile                  # Multi-stage production container build
├── .env.example                # Documented configuration template
└── package.json                # Project dependencies and scripts
```

---

## 📡 Live Market Data Providers

| Category | Primary Provider | Free Key Needed? | Fallback / Notes |
| :--- | :--- | :--- | :--- |
| **US Equities** | Finnhub API | **Yes** (`FINNHUB_API_KEY`) | Free personal tier from [finnhub.io](https://finnhub.io/). |
| **Indian Equities & Indices** | Upstox API v3 | **Optional** (`UPSTOX_ANALYTICS_TOKEN`) | Free read-only 1-year Analytics Token from [developer.upstox.com](https://developer.upstox.com/). Reports `UNCONFIGURED` when missing. |
| **Upstox WebSocket Feed** | Upstox Protobuf WS | **Optional** (`UPSTOX_ANALYTICS_TOKEN`) | Subscribes to NSE/BSE feeds using `MarketDataFeed.proto`. |
| **Cryptocurrency** | CoinGecko API | **No** (Public endpoint) | Optional `COINGECKO_DEMO_API_KEY` for higher rate limits. |
| **Spot Metals (Gold & Silver)**| GoldAPI.io / Gold-API | **No** (Automatic fallback) | Uses GoldAPI.io if `GOLD_API_KEY` is present; falls back to free public gold-api.com. |
| **Foreign Exchange (USD/INR)**| Frankfurter | **No** (Public reference) | ECB-backed daily reference rate. Clearly marked as delayed reference rate. |
| **Financial News** | Finnhub News | **Yes** (`FINNHUB_API_KEY`) | Live verified headlines directly linked to publisher sources. |

---

## 🤖 Dual AI Engine Pipeline

1. **Google Gemini (Default)**:
   - Uses `GEMINI_API_KEY` server-side via the `@google/genai` SDK.
   - Synthesizes market news, price context, and asset category into actionable Buy/Sell/Hold analytical sentiment with explicit confidence and rationale.
2. **FinBERT (Hugging Face)**:
   - Uses `HUGGINGFACE_API_KEY` (or `HF_TOKEN`) server-side to query `ProsusAI/finbert` on Hugging Face Serverless Inference.
   - Measures pure NLP financial sentiment without pretending to predict future price direction.
   - If key or model is unavailable, reports explicit `unavailable` status — never falls back to labeling Gemini as FinBERT.

---

## 🔒 Security & Data Transparency

- **Zero Client-Side Secrets**: All third-party provider keys stay strictly on the server. No `VITE_*` secrets exist in frontend bundles.
- **Data Freshness Badges**: Every quote clearly indicates its provenance:
  - `LIVE`: Verified real-time from provider within session hours.
  - `DELAYED`: Valid feed observation older than 2 minutes.
  - `CACHED`: Bounded server memory cache hit.
  - `STALE`: Outdated source timestamp.
  - `UNAVAILABLE`: Provider failed or rate-limited.
  - `UNCONFIGURED`: Optional key has not yet been supplied.
- **Production AI Protection**: When deployed with `NODE_ENV=production`, AI endpoints require `AI_ACCESS_TOKEN` in the `Authorization: Bearer <token>` header to prevent unauthorized quota drain.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v22.14.0 or later
- **npm**: v10+

### 2. Installation
```bash
git clone https://github.com/Khatri-369/AI-TRADING.git
cd AI-TRADING
npm install
```

### 3. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Edit `.env` and add your keys:
```env
GEMINI_API_KEY=your_gemini_api_key
FINNHUB_API_KEY=your_finnhub_api_key
HUGGINGFACE_API_KEY=your_huggingface_token
# Optional:
UPSTOX_ANALYTICS_TOKEN=your_upstox_token
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Quality Assurance

Run the comprehensive 28-test automated test suite:
```bash
npm test
```
Run type-checking:
```bash
npm run lint
```
Build the production bundle:
```bash
npm run build
```
Run in production mode:
```bash
npm start
```

---

## 🐳 Docker Deployment

The application includes an optimized multi-stage `Dockerfile`:
```bash
docker build -t ai-trading-platform .
docker run -p 3000:3000 --env-file .env ai-trading-platform
```

---

## ⚖️ Financial Disclaimer

*The analysis, sentiment ratings, Buy/Sell/Hold recommendations, and scenario simulations generated by this application are for informational and educational purposes only. They do not constitute personalized financial, investment, legal, or tax advice. Market data may be delayed. Always perform your own independent due diligence before executing trades.*
