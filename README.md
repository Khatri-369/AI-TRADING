# Global Markets Command Center

React/TypeScript market-intelligence dashboard with an Express backend. Quotes, news and charts come from providers; absent or failing sources produce unavailable/stale states. There are no generated prices, fabricated news stories, trading orders or simulated live feeds.

## Run locally

For Vercel deployment, desktop installation and opt-in background news alerts, see [DEPLOYMENT.md](DEPLOYMENT.md). The frontend runs on Vercel; an always-on Express backend with a private persistent disk handles streaming and push delivery.

Requires Node.js 22.14+ and npm.

```sh
npm ci
```

Copy `.env.example` to `.env`, fill only the providers you use, then:

```sh
npm run dev
```

Open http://localhost:3000. Restart the backend after editing `.env` (Vite hot reload covers frontend edits only). `PORT` and `HOST` are configurable.

```sh
npm run lint
npm test
npm run build
npm start
```

The production bundle is `dist/server.js`; the frontend is `dist/client`. `npm start` selects production mode without requiring platform-specific environment syntax. SPA deep links are supported. `/api/health` reports process health and sanitized provider observations; configured does not mean a live request has succeeded.

## Providers and credentials

- **Upstox:** `UPSTOX_ANALYTICS_TOKEN`, the one-year read-only Analytics Token from [Developer Apps](https://account.upstox.com/developer/apps). No OAuth login/refresh flow and no order placement. Supports official instrument masters, batched NSE/BSE quotes, NIFTY 50, BANK NIFTY, SENSEX, market status and historical candles. `.BSE` suffixes distinguish BSE listings. The backend authorizes and decodes the V3 Protobuf WebSocket and sends normalized observations to browsers through SSE. Credentials and authorized WebSocket URLs never reach the browser. Missing tokens report `UNCONFIGURED`. Expired/invalid tokens produce provider errors. [Analytics Token documentation](https://upstox.com/developer/api-documentation/analytics-token/).
- **Finnhub:** `FINNHUB_API_KEY` for eight US instruments and financial news. The free personal tier covers quotes/news; historical candles depend on account entitlement. [Documentation](https://finnhub.io/docs/api).
- **CoinGecko:** public API for BTC, ETH, BNB, SOL and XRP; optional `COINGECKO_DEMO_API_KEY`. Prices are USD, changes and notional USD volume cover 24 hours. Historical range availability/rate limits depend on the plan. [Documentation](https://docs.coingecko.com/).
- **Metals:** public [Gold-API](https://gold-api.com/) by default, USD/troy ounce for gold and silver. Optional `GOLD_API_KEY` chooses GoldAPI.io. No metals history is implemented. Missing daily changes stay blank. Selecting GoldAPI does not silently fall back to another source after failure.
- **Forex:** public [Frankfurter](https://frankfurter.dev/) USD/INR daily reference rates and daily history. These are delayed reference observations, not live tradable FX quotes. No API key.
- **Gemini:** `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`, verified with the configured account). On-demand structured sentiment analysis and interactive research chat. Model availability, quota and free-tier eligibility vary by account. Unavailable/timeout responses are explicit.
- **FinBERT:** `HUGGINGFACE_API_KEY` with Inference Providers access. Calls genuine `ProsusAI/finbert`; never falls back to Gemini or keywords. Requires available account credits/model service. Engine status is unavailable on failure.

## Architecture

- `server.ts`: startup, Vite development middleware, production static serving and shutdown.
- `server/app.ts`, `server/config.ts`: validated routes, configuration, safe errors, Helmet and rate limits.
- `server/market/`: replaceable provider adapters, bounded caches, source freshness, sessions, Upstox WebSocket and SSE fan-out.
- `server/market/feedSchema.ts`: generated TypeScript schema from the checked-in official `MarketDataFeed.proto`. Bundled into production; no runtime schema download/path dependency.
- `server/ai/`: validated Gemini/FinBERT clients, prompts, bounded request/result caching.
- `shared/`: typed API contracts and instrument directory (names/symbols, never prices).
- `src/services/`, `src/hooks/`, `src/components/`: same-origin API client, polling/stream lifecycle, accessible dashboard, charts, provider settings, news and research desk UI.

## API

- `GET /api/health`
- `GET /api/markets/overview`
- `GET /api/markets/us`, `/india`, `/crypto`, `/commodities`, `/forex`
- `GET /api/markets/history/:symbol?range=1D|5D|1M|3M|6M|1Y` (URL-encode symbols such as USD/INR)
- `GET /api/stream/live-ticks` (SSE; normalized Upstox observations)
- `GET /api/news`
- `POST /api/ai/analyze` with `{ "headline": "...", "engine": "gemini" }` and optional known `symbol`
- `POST /api/ai/chat` with `{ "question": "...", "conversation": [...] }`

Production AI requires `Authorization: Bearer <AI_ACCESS_TOKEN>`. This application access token is not an API provider secret; the Settings input holds it in memory only. AI is disabled in production when the token is empty. Development AI remains usable locally. No provider keys are accepted in request bodies or UI inputs.

## Refresh and correctness

Browser overview polling runs every 60 seconds after the preceding request completes; news every five minutes. Hidden tabs cancel polling and close SSE. One Upstox connection is shared across active SSE clients, with bounded exponential reconnect and heartbeats. Slow clients are disconnected. No stream is created merely by importing a module or running tests.

Backend cache TTLs: crypto 60 seconds; equities 60 seconds during sessions, 30 minutes closed; public metals 60 seconds; GoldAPI 24 hours by default; forex six hours; news five minutes; intraday history five minutes, other history one hour. Source timestamps never advance when a refresh fails. Concurrent identical requests share work. Failures cool down for 60 seconds; retained data is explicitly stale and has a bounded retention window. AI caches identical evidence for ten minutes (analysis) or one minute (chat).

Quotes expose provider, source time, fetched time, cache flag and data status. Closed-session observations are delayed, never live. US schedule uses New York DST and published NYSE 2026–2028 holidays/early closes; unexpected halts are not tracked. Indian sessions use Upstox, with a clearly described weekday estimate if unavailable. Crypto is 24/7. Metals session is unknown; forex is daily reference data.

## Tests and live verification

`npm test` uses controlled test fixtures only in test files and never spends provider quota. Browser tests require a running server and Microsoft Edge installed:

```sh
npm run test:browser
```

`playwright.config.ts` can be changed to an installed Chromium channel. Tests cover desktop navigation/search/refresh/settings, real Indian charts, mobile overflow and runtime errors. Screenshots go to gitignored `test-results/`.

To explicitly spend a small number of read-only provider requests and verify configured credentials:

```sh
npm run verify:live
npm run verify:live -- --ai
```

The second command additionally makes small AI requests. Neither logs secrets. Successful WebSocket snapshots outside market hours do not establish that changing intraday ticks have been observed.

## Production deployment

Deploy to a persistent Node host, using `npm ci`, `npm run build`, then `npm start`. Configure environment secrets on the server and use HTTPS through a reverse proxy. Allow SSE streaming without proxy buffering. Set `TRUST_PROXY_HOPS` to the exact trusted proxy count, never blindly enable proxy trust. Caches/rate limits are per process; multiple replicas need shared quotas/rate limiting and coordination of Upstox connection limits.

A multi-stage `Dockerfile` is included (`docker build -t market-command-center .`; `docker run --env-file .env -p 3000:3000 market-command-center`). The container runs as a non-root user. Docker execution has not been verified in this workspace. CI runs install, typecheck, tests and build.

## Limitations

TATAMOTORS is retained as a requested symbol but is unavailable if absent from the provider's current instrument directory. It is never mapped to a different company automatically. Historical endpoints may exclude today's unfinished session; chart timestamps show the actual coverage. Upstox index/stock coverage and entitlements remain provider-controlled. Missing candle data is never interpolated into fake history. Metals charts are unavailable. There are no fake geopolitical maps, fear/greed scores or automatic AI calls on render.

Market-data licenses and redistribution rights depend on your provider agreement. Verify commercial/public redistribution permissions before deployment. This project does not claim a license to redistribute provider data.

AI-generated signals are informational and are not financial advice. Market data may be delayed. Users should independently verify information before making investment decisions.
## Advanced research tools

- Bottom-right robot button: Gemini conversation with follow-up questions, optional instrument focus, and references resolved from backend quotes/news. Source timestamps and limitations accompany answers. Current scope does not include web search, financial statements or historical series in chat.
- `/watchlist`: browser-local saved instruments, market/search filters, change sorting, and a three-instrument comparison with currencies, provider freshness and observation times. Watchlists do not sync between devices.
- `POST /api/ai/chat`: accepts `{ message, history?, symbols? }`; validates bounded input and output, rejects client-supplied market evidence, uses the existing access/CSRF/quota gates and never exposes provider credentials. Recent conversation turns are sent to Gemini as untrusted context. Conversations remain in app memory across navigation and closing the panel, and clear on reload or New conversation; successful answers may be cached briefly in bounded server memory.
- Tests: `npm test` covers the chat provider and HTTP contracts. `npm run test:browser -- tests/browser/research.spec.ts` verifies both themes, source references, follow-up error recovery, saved-list persistence and comparison limits using explicit test fixtures. These fixtures are not production data.

## Contributing

Contributions, bug reports, and feature proposals are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code standards, local setup, test commands, and pull request guidelines.

## License

This project is open-source software licensed under the [MIT License](LICENSE).

