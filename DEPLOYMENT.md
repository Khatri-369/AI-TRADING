# Production Deployment & Operations Guide

This guide provides step-by-step procedures for deploying, configuring, monitoring, and rolling back the **Global Markets Command Center** in a production environment.

---

## 1. Deployment Topology Architecture

```
Internet (Public Users)
       │
       ▼ (HTTPS / 443 - SSL Termination, WAF, Rate Limiting)
┌─────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                     │
│  - SSL Termination (Let's Encrypt TLS 1.3)                  │
│  - Static Asset Caching (/assets/* with immutable max-age)  │
│  - SSE Streaming Passthrough (/api/stream/* no buffering)   │
│  - Security Headers & Request Filtering                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (HTTP / 127.0.0.1:3000)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           Node.js 22 LTS Process (dist/server.js)           │
│  - Bounded Single-Instance Deployment                       │
│  - Express REST API & Vite SPA Client Server                │
│  - Anti-CSRF Verification (X-Requested-With)                │
│  - Process-Local AI Spending Guard (Daily budget & 2 conc)  │
│  - In-Memory Cache & Sliding-Window Quota Tracker           │
│  - Upstox V3 Protobuf WebSocket Client (1 conn to Upstox)   │
│  - In-Memory SSE Dispatcher (Max 100 concurrent clients)    │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Scope: Single-Instance Boundary
> [!IMPORTANT]
> **This application is architected and validated as a bounded single-instance deployment.**
> 
> The following components are **process-local**:
> 1. **Upstox V3 WebSocket**: An Upstox API account is entitled to **one active WebSocket connection**. Running multiple Node.js replicas would open conflicting WebSocket streams and cause Upstox connection disconnect loops.
> 2. **AI Spending Limits & Quotas**: The sliding-window daily budget (`AI_DAILY_BUDGET_LIMIT`) and per-client daily quota (`AI_PER_CLIENT_DAILY_LIMIT`) are tracked in memory.
> 3. **SSE Dispatcher**: Browser SSE clients subscribe directly to the server process memory ring.
>
> **Do not deploy behind a round-robin multi-instance load balancer** without first introducing an external Redis cluster for distributed rate limiting and a dedicated standalone market-ingest worker to coordinate Upstox feeds.

---

## 2. Server Requirements & Dependencies

- **Operating System**: Linux (Ubuntu 22.04 / 24.04 LTS or Debian 12 recommended).
- **Node.js**: Version **22.14.0 LTS** or higher.
- **Reverse Proxy**: Nginx 1.20+ or Caddy 2.7+.
- **Process Manager**: Systemd (built-in) or PM2.
- **Compute**: Minimum 1 vCPU, 2 GB RAM (4 GB recommended).

---

## 3. Environment Variables Reference (`.env`)

Create a production `.env` file in the application root directory (mode `0600`):

```bash
# Server Network Configuration
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
TRUST_PROXY_HOPS=1

# Security & Admin Access
SESSION_SECRET=GENERATE_A_RANDOM_HIGH_ENTROPY_STRING_MIN_16_CHARS
ADMIN_DIAGNOSTICS_TOKEN=GENERATE_A_STRONG_RANDOM_OPERATOR_ADMIN_PASSWORD

# Public AI Access & Spending Controls
ANONYMOUS_AI_QUOTA_ENABLED=true
AI_PER_CLIENT_DAILY_LIMIT=5
AI_DAILY_BUDGET_LIMIT=100

# SSE Streaming Limits
SSE_MAX_CLIENTS=100

# Backend Market Data Providers (Read-only analytics tokens)
UPSTOX_ANALYTICS_TOKEN=your_long_lived_analytics_token
FINNHUB_API_KEY=your_finnhub_key
COINGECKO_DEMO_API_KEY=your_coingecko_key
GOLD_API_KEY=your_gold_api_key

# Backend AI Engines
GEMINI_API_KEY=your_google_gemini_key
GEMINI_MODEL=gemini-2.5-flash
HUGGINGFACE_API_KEY=your_huggingface_key
```

---

## 4. Nginx Reverse Proxy Configuration with SSE

Create `/etc/nginx/sites-available/global-markets.conf`:

```nginx
server {
    listen 80;
    server_name research.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name research.example.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/research.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/research.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Static asset caching
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # CRITICAL: Server-Sent Events (SSE) streaming configuration
    location /api/stream/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering and chunk delays
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;
        chunked_transfer_encoding off;
    }

    # Application endpoints & SPA fallback
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/global-markets.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Systemd Service Configuration

Create `/etc/systemd/system/global-markets.service`:

```ini
[Unit]
Description=Global Markets Command Center Production Service
After=network.target

[Service]
Type=simple
User=nodeapp
WorkingDirectory=/opt/global-markets
EnvironmentFile=/opt/global-markets/.env
ExecStart=/usr/bin/node dist/server.js --production
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=15
LimitNOFILE=65535

# Process Hardening
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/global-markets/logs
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable global-markets.service
sudo systemctl start global-markets.service
```

---

## 6. Build & Deployment Execution Steps

```bash
# 1. Clone repository
cd /opt/global-markets

# 2. Install dependencies strictly from lockfile
npm ci

# 3. Run validation checks
npm run lint
npm test

# 4. Build client assets and server bundle
npm run build

# 5. Restart application service gracefully
sudo systemctl restart global-markets.service

# 6. Verify health endpoint
curl -s http://127.0.0.1:3000/api/health | jq .
```

---

## 7. Rollback Procedure

If a deployed build exhibits unexpected issues or regressions:

1. **Restore Previous Artifacts**:
   ```bash
   # Checkout previous verified commit
   git checkout <PREVIOUS_STABLE_COMMIT_HASH>
   npm ci
   npm run build
   sudo systemctl restart global-markets.service
   ```
2. **Verify Recovery**:
   ```bash
   curl -s http://127.0.0.1:3000/api/health
   ```
3. **Inspect Application Logs**:
   ```bash
   sudo journalctl -u global-markets.service -n 100 --no-pager
   ```

---

## 8. Staging Smoke Test Procedure

Run the automated smoke test script before pointing public DNS:
```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh http://127.0.0.1:3000
```
This tests:
- Sanitized public health response (`/api/health`).
- Security headers (CSP, nosniff, frameguard).
- CSRF protection (verifying that POST without `X-Requested-With` is rejected with HTTP 403).
- SSE stream connectivity and heartbeat reception (`/api/stream/live-ticks`).
- Market overview quote payloads.
- AI session quota tracking (`/api/ai/quota`).
