# Public Launch & Redistribution Release Blockers

This document details the legal, provider licensing, account quota, and hosting infrastructure dependencies that must be formally resolved before making this application publicly accessible to external end-users.

---

## 1. Market Data Redistribution & Licensing Blockers

### A. Indian Equities & Indices (NSE / BSE via Upstox)
- **Current Status**: Authenticated via personal `UPSTOX_ANALYTICS_TOKEN` from backend environment.
- **Provider / Exchange Policy**:
  - The National Stock Exchange of India (NSE) and Bombay Stock Exchange (BSE) strictly regulate the dissemination of market data.
  - Personal trading and analytics API keys provided by Upstox are licensed **solely for personal non-commercial algorithmic trading or private market research**.
  - **Public Redistribution Prohibited**: Broadcasting real-time or delayed market data to arbitrary external third parties via a public web application without an authorized **NSE/BSE Market Data Redistribution Agreement** is a direct violation of exchange data feed compliance and Upstox terms of service.
- **Release Blocker**: To launch as a commercial or unrestricted public service, the operator must obtain an official data vendor / redistribution license or execute a commercial agreement with an authorized market data vendor.

### B. US Equities, SPY & Market News (Finnhub)
- **Current Status**: Authenticated via personal free-tier API key (`FINNHUB_API_KEY`).
- **Provider Policy**:
  - Finnhub's free tier is strictly intended for personal evaluation and non-commercial prototyping.
  - Free US quotes are derived from Cboe/BATS and are delayed or limited in depth compared to the consolidated tape (CTA/UTP).
  - Finnhub Terms of Service require a **Commercial Redistribution License** for publicly hosted consumer websites.
  - Historical candle endpoints (`/stock/candle`) require an upgraded paid entitlement; personal free keys return HTTP 403.
- **Attribution Status**: Properly credited with link to `finnhub.io` in the UI and disclosures modal.
- **Release Blocker**: Upgrading to a commercial Finnhub plan is required for legal public display and historical US candle charting.

### C. Digital Assets & Cryptocurrency (CoinGecko)
- **Current Status**: Connected via free Demo plan (`COINGECKO_DEMO_API_KEY`).
- **Provider Policy**:
  - CoinGecko terms permit non-commercial use with required attribution ("Powered by CoinGecko" with a do-follow link to `https://www.coingecko.com`).
  - High-traffic public consumer applications require CoinGecko's **Pro / Enterprise API** to avoid IP bans and harsh 30 req/min rate limit throttling.
- **Attribution Status**: "Powered by CoinGecko" attribution link implemented in `ProductDisclosuresModal.tsx`.
- **Release Blocker**: Commercial traffic volumes require a paid CoinGecko subscription.

### D. Precious Metals (Gold-API.com) & Foreign Exchange (Frankfurter)
- **Current Status**: Indicative spot prices for XAU/XAG; Frankfurter provides daily ECB reference rates.
- **Provider Policy**:
  - Spot metals are indicative and intended for reference only.
  - Frankfurter provides once-per-business-day European Central Bank rates; intraday continuous FX streaming is not supported.

---

## 2. Artificial Intelligence Engine Quota & Provider Dependencies

### A. Hugging Face / ProsusAI FinBERT
- **Current Status**: Free serverless inference endpoint (`router.huggingface.co/hf-inference/models/ProsusAI/finbert`) returned HTTP 429 quota exhaustion during live tests.
- **Application Behavior**: The system safely returns `AI_RATE_LIMITED` / `engineStatus: unavailable` without synthetic fabrications.
- **Release Blocker**: For public launch SLA, the operator must deploy a dedicated **Hugging Face Dedicated Inference Endpoint** or fund an organization account with prepaid inference credits.

### B. Google Gemini 2.5 Flash
- **Current Status**: Verified and operational on Google AI Studio / Gemini API.
- **Spending & Abuse Safeguards**:
  - Global daily server spending cap implemented (`AI_DAILY_BUDGET_LIMIT=100`).
  - Concurrency limiter implemented (`MAX_CONCURRENT_AI=2`).
  - Anonymous session quota implemented (`AI_PER_CLIENT_DAILY_LIMIT=5` queries per rolling 24h window).
- **Release Blocker**: Billing threshold alerts and budget caps must be configured in Google Cloud Console before opening public access.

---

## 3. Infrastructure & Deployment Dependencies

### A. Host Docker Environment
- **Current Status**: `Dockerfile` is provided in the repository with a multi-stage production build and healthcheck.
- **Local Environment Limitation**: Docker CLI / Docker daemon is **not installed** on this local Windows development workstation (`docker : The term 'docker' is not recognized`). Docker container builds could not be locally executed.
- **Release Blocker**: Docker build and container run must be validated on the Linux target host or CI/CD runner (`docker build -t global-markets .`).

### B. Public Hosting & Domain Deployment
- **Current Status**: Application is thoroughly tested and operational locally (`http://localhost:3000`).
- **Deployment Status**: Not yet deployed to a public cloud instance (VPS/AWS/GCP/DigitalOcean).
- **Required Steps**:
  1. Provision a Linux VPS (Ubuntu 24.04 LTS or Debian 12).
  2. Setup Nginx reverse proxy with SSL termination (Let's Encrypt).
  3. Configure production `.env` with strong `SESSION_SECRET` and `ADMIN_DIAGNOSTICS_TOKEN`.
  4. Run automated smoke tests (`scripts/smoke-test.sh`).
