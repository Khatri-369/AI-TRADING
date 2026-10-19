import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ServerConfig } from './config';
import { marketService } from './market/index';
import { liveStreamManager } from './market/liveStream';
import { analyze, scenario, chat, aiProviderStatuses, AIServiceError } from './ai/index';
import { chatInputSchema } from '../shared/chat';
import { prepareChatContext, prepareChartEvidence } from './ai/chatContext';
import { newsPush } from './push';
import { authorizedNewsJob, oneSignalPush, usesOneSignal } from './push/onesignal';
import { subscriptionSchema } from './push/service';
import { intervals } from '../shared/research';
import { workspaceStore } from './workspace/store';
import { workspaceRouter, workspaceUser } from './workspace/routes';
import { aiSpendingGuard } from './ai/spendingGuard';
import { metrics } from './metrics';
import { logger } from './logger';
import { ASSET_BY_SYMBOL, HISTORY_RANGES } from '../shared/assets';

const headlineInput = z
  .object({
    headline: z.string().trim().min(5).max(2000),
    engine: z.enum(['gemini', 'finbert']).default('gemini'),
    symbol: z
      .string()
      .max(30)
      .refine((value) => ASSET_BY_SYMBOL.has(value), 'Unknown asset')
      .optional(),
  })
  .strict();

const scenarioInput = z.object({ scenario: z.string().trim().min(10).max(2000) }).strict();
const historyRange = z.enum(HISTORY_RANGES);

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

/**
 * Extract or generate a client session identifier for quota tracking.
 * Uses an httpOnly secure session cookie or client IP.
 */
function getClientId(req: express.Request, res: express.Response): string {
  const cookieHeader = req.headers.cookie ?? '';
  const match = cookieHeader.match(/market_session=([a-zA-Z0-9_-]+)/);
  let sessionId = match ? match[1] : undefined;
  if (!sessionId) {
    sessionId = randomUUID();
    res.cookie('market_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: 30 * 24 * 3600 * 1000,
    });
  }
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return `${clientIp}:${sessionId}`;
}

/**
 * Verify administrative authorization for diagnostics or unlimited quota bypass.
 */
function isAdminRequest(req: express.Request, adminToken?: string): boolean {
  if (!adminToken) return false;
  const authHeader = req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.get('x-admin-token');
  if (!authHeader) return false;
  const supplied = Buffer.from(authHeader);
  const expected = Buffer.from(adminToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/**
 * Anti-CSRF verification on POST endpoints.
 * Requires custom request header (standard defense for single-page web apps).
 */
const csrfProtection: RequestHandler = (req, res, next) => {
  if (req.method === 'POST') {
    const hasHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
    if (!hasHeader) {
      res.status(403).json({
        error: 'Security header missing (X-Requested-With required). CSRF verification failed.',
        code: 'CSRF_VERIFICATION_FAILED',
      });
      return;
    }
  }
  next();
};

export function createApp(config: ServerConfig, production = config.NODE_ENV === 'production') {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);

  // Set SSE streaming capacity from config
  liveStreamManager.setMaxClients(config.SSE_MAX_CLIENTS);

  // Production security headers
  app.use(
    helmet({
      hidePoweredBy: false,
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", 'https://cdn.onesignal.com'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'", 'https://*.onesignal.com'],
              frameSrc: ["'self'", 'https://*.onesignal.com'],
              workerSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: null,
            },
          }
        : false,
      strictTransportSecurity: production
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      xContentTypeOptions: true,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Global API no-store & metrics recorder
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    const start = Date.now();
    res.on('finish', () => {
      metrics.recordRequest(res.statusCode >= 500);
      if (res.statusCode >= 500) {
        logger.warn(`${req.method} ${req.originalUrl} failed with status ${res.statusCode} (${Date.now() - start}ms)`);
      }
    });
    next();
  });

  // Global API rate limiter (120 req/min)
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' },
    })
  );

  // Chart annotations and multilingual conversations need a bounded larger body.
  app.use(['/api/workspace', '/api/ai/chat'], express.json({ limit: '64kb', strict: true }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use('/api/workspace', workspaceRouter(production));

  app.get('/api/notifications/config', asyncRoute(async (_req, res) => {
    if (usesOneSignal()) {
      res.json({ provider: 'onesignal', configured: oneSignalPush.configured && (process.env.CRON_SECRET?.length ?? 0) >= 32,
        appId: process.env.ONESIGNAL_APP_ID, publicKey: null, intervalMinutes: 5 });
    } else res.json({ ...await newsPush.status(), provider: 'native' });
  }));
  const notificationLimit = rateLimit({ windowMs: 60000, limit: 10, message: { error: 'Too many notification changes. Try again shortly.' } });
  for (const action of ['subscribe', 'unsubscribe', 'test'] as const) {
    app.post(`/api/notifications/${action}`, notificationLimit, csrfProtection, asyncRoute(async (req, res) => {
      const parsed = subscriptionSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: 'Unsupported or invalid browser push subscription.' }); return; }
      try { await newsPush[action](parsed.data, workspaceUser(req)?.id.toString()); res.json({ ok: true }); }
      catch { res.status(503).json({ error: 'Notifications could not be updated. Check server configuration or try later.' }); }
    }));
  }
  app.get('/api/cron/news', asyncRoute(async (req, res) => {
    if (!authorizedNewsJob(req.get('authorization'))) { res.status(401).json({ error: 'Unauthorized news job.' }); return; }
    if (usesOneSignal() ? !oneSignalPush.configured : !(await newsPush.status()).configured) {
      res.status(503).json({ error: 'Background news delivery is not configured.' }); return;
    }
    if (usesOneSignal()) {
      const result = await oneSignalPush.deliver(() => marketService.news(true));
      const degraded = result.failed > 0 || ('feedUnavailable' in result && result.feedUnavailable) || ('review' in result && result.review > 0);
      res.status(degraded ? 503 : 200).json({ ok: !degraded, ...result, timestamp: new Date().toISOString() });
      return;
    }
    const news = await marketService.news();
    if (news.status === 'unavailable' || news.status === 'stale') { res.status(503).json({ error: 'Fresh news is unavailable; retry the job later.' }); return; }
    await newsPush.deliver(news);
    res.json({ ok: true, count: news.articles.length, timestamp: new Date().toISOString() });
  }));

  /**
   * Sanitized Public Health Endpoint.
   * Publicly accessible, fast, discloses zero internal keys or unmasked hostnames.
   */
  app.get('/api/health', asyncRoute(async (_req, res) => {
    const rawProviders = [...marketService.providerStatuses(), ...aiProviderStatuses()];
    const providers = rawProviders.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.configured ? p.status : p.id.startsWith('upstox') ? 'UNCONFIGURED' : 'unconfigured',
    }));

    const isDegraded = rawProviders.some(
      (p) => p.configured && (p.status === 'unavailable' || p.status === 'rate-limited')
    );

    let accountStorage = false;
    try { workspaceStore(); accountStorage = true; } catch { /* Optional persistent storage. */ }
    const push = await newsPush.status();
    res.json({
      features: { accountSync: accountStorage ? 'configured' : 'unconfigured', backgroundPriceAlerts: accountStorage && !process.env.VERCEL ? 'configured' : 'unconfigured', webPush: push.configured ? 'configured' : 'unconfigured', orderPlacement: 'disabled' },
      status: isDegraded ? 'degraded' : 'ok',
      version: '1.0.0',
      uptimeSeconds: metrics.getUptimeSeconds(),
      generatedAt: new Date().toISOString(),
      providers,
      aiAccess: !production
        ? 'local'
        : config.ANONYMOUS_AI_QUOTA_ENABLED
        ? 'anonymous_quota'
        : config.ADMIN_DIAGNOSTICS_TOKEN
        ? 'protected'
        : 'disabled',
    });
  }));

  /**
   * Protected Administrative Diagnostics Endpoint.
   * Requires ADMIN_DIAGNOSTICS_TOKEN.
   */
  app.get('/api/admin/diagnostics', (req, res) => {
    if (!config.ADMIN_DIAGNOSTICS_TOKEN) {
      res.status(403).json({
        error: 'Administrative diagnostics are disabled on this instance.',
        code: 'ADMIN_DIAGNOSTICS_DISABLED',
      });
      return;
    }
    if (!isAdminRequest(req, config.ADMIN_DIAGNOSTICS_TOKEN)) {
      res.status(401).json({
        error: 'Administrative authorization token required.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: metrics.getDetailedDiagnostics(),
      aiSpending: aiSpendingGuard.getSpendingMetrics(),
      rawProviders: [...marketService.providerStatuses(), ...aiProviderStatuses()],
    });
  });

  /**
   * Public Markets Data
   */
  app.get(
    '/api/markets/overview',
    asyncRoute(async (_req, res) => {
      res.json(await marketService.overview());
    })
  );

  for (const category of ['us', 'india', 'crypto', 'commodities', 'forex'] as const) {
    app.get(
      `/api/markets/${category}`,
      asyncRoute(async (_req, res) => {
        const overview = await marketService.overview(category);
        res.json({ ...overview, quotes: overview.quotes.filter((quote) => quote.category === category) });
      })
    );
  }

  app.get(
    '/api/markets/history/:symbol',
    asyncRoute(async (req, res) => {
      const symbol = String(req.params.symbol);
      if (!ASSET_BY_SYMBOL.has(symbol)) {
        res.status(404).json({ error: 'Unknown asset.', code: 'UNKNOWN_ASSET' });
        return;
      }
      const range = historyRange.safeParse(req.query.range ?? '1M');
      if (!range.success) {
        res.status(400).json({ error: 'Unsupported history range.', code: 'INVALID_INPUT' });
        return;
      }
      res.json(await marketService.history(symbol, range.data));
    })
  );

  /**
   * Server-Sent Events (SSE) Live Feed.
   * Configured for reverse proxy streaming with heartbeats & connection limits.
   */
  app.get('/api/stream/live-ticks', (req, res) => {
    liveStreamManager.addClient(req, res);
  });

  app.get(
    '/api/news',
    asyncRoute(async (_req, res) => {
      const news = await marketService.news();
      void newsPush.deliver(news).catch(() => undefined);
      res.json(news);
    })
  );

  app.get('/api/markets/candles/:symbol', asyncRoute(async (req, res) => {
    const symbol = String(req.params.symbol);
    const interval = z.enum(intervals).safeParse(req.query.interval ?? '1d');
    const range = historyRange.safeParse(req.query.range ?? '1M');
    if (!ASSET_BY_SYMBOL.has(symbol) || !interval.success || !range.success) { res.status(400).json({ error: 'Unsupported instrument, range or candle interval.' }); return; }
    res.json(await marketService.candles(symbol, interval.data, range.data));
  }));

  /**
   * AI Quota Status Check.
   * Tells the frontend how many AI queries remain in the current session.
   */
  app.get('/api/ai/quota', (req, res) => {
    const isAdmin = isAdminRequest(req, config.ADMIN_DIAGNOSTICS_TOKEN);
    const clientId = getClientId(req, res);
    const status = aiSpendingGuard.checkQuota(clientId, isAdmin);
    res.json(status);
  });

  /**
   * AI Access Gate Middleware.
   * Checks whether AI is globally disabled or requires admin authorization.
   */
  app.use('/api/ai', (req, res, next) => {
    const isAdmin = isAdminRequest(req, config.ADMIN_DIAGNOSTICS_TOKEN);

    // If anonymous quota is disabled, require admin token
    if (!config.ANONYMOUS_AI_QUOTA_ENABLED && !isAdmin) {
      if (!production) {
        next();
        return;
      }
      if (!config.ADMIN_DIAGNOSTICS_TOKEN) {
        res.status(503).json({
          error: 'AI access is disabled until the server administrator configures access.',
          code: 'AI_ACCESS_DISABLED',
          engineStatus: 'unavailable',
        });
        return;
      }
      res.status(401).json({
        error: 'An application access token is required for AI requests.',
        code: 'AI_ACCESS_REQUIRED',
        engineStatus: 'unavailable',
      });
      return;
    }
    next();
  });

  // Dedicated AI request limiter (10 req/min per IP)
  app.use(
    '/api/ai',
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'AI request limit reached. Try again in a minute.',
        code: 'RATE_LIMITED',
        engineStatus: 'unavailable',
      },
    })
  );

  /**
   * AI Headline & Momentum Analysis.
   */
  app.post(
    '/api/ai/analyze',
    csrfProtection,
    asyncRoute(async (req, res) => {
      const isAdmin = isAdminRequest(req, config.ADMIN_DIAGNOSTICS_TOKEN);
      const clientId = getClientId(req, res);

      let releaseSlot: (() => void) | undefined;
      try {
        releaseSlot = aiSpendingGuard.acquire(clientId, isAdmin);
      } catch (cause) {
        const quotaErr = cause as { code: string; status: number; message: string; resetInSeconds?: number };
        if (quotaErr.resetInSeconds) {
          res.set('Retry-After', String(quotaErr.resetInSeconds));
        }
        res.status(quotaErr.status || 429).json({
          error: quotaErr.message,
          code: quotaErr.code,
          engineStatus: 'unavailable',
        });
        return;
      }

      try {
        const input = headlineInput.safeParse(req.body);
        if (!input.success) {
          res.status(400).json({
            error: 'Provide a headline (5–2000 characters), a supported engine and optional known symbol.',
            code: 'INVALID_INPUT',
          });
          return;
        }

        const context =
          input.data.engine === 'gemini' && process.env.GEMINI_API_KEY
            ? await buildContext(input.data.symbol)
            : undefined;

        res.json(await analyze(input.data, context));
      } finally {
        releaseSlot?.();
      }
    })
  );

  /**
   * AI Macro Scenario Modeling.
   */
  app.post(
    '/api/ai/scenario',
    csrfProtection,
    asyncRoute(async (req, res) => {
      const isAdmin = isAdminRequest(req, config.ADMIN_DIAGNOSTICS_TOKEN);
      const clientId = getClientId(req, res);

      let releaseSlot: (() => void) | undefined;
      try {
        releaseSlot = aiSpendingGuard.acquire(clientId, isAdmin);
      } catch (cause) {
        const quotaErr = cause as { code: string; status: number; message: string; resetInSeconds?: number };
        if (quotaErr.resetInSeconds) {
          res.set('Retry-After', String(quotaErr.resetInSeconds));
        }
        res.status(quotaErr.status || 429).json({
          error: quotaErr.message,
          code: quotaErr.code,
          engineStatus: 'unavailable',
        });
        return;
      }

      try {
        const input = scenarioInput.safeParse(req.body);
        if (!input.success) {
          res.status(400).json({ error: 'Provide a scenario of 10–2000 characters.', code: 'INVALID_INPUT' });
          return;
        }

        res.json(await scenario(input.data, process.env.GEMINI_API_KEY ? await buildContext() : undefined));
      } finally {
        releaseSlot?.();
      }
    })
  );

  app.post('/api/ai/chat', csrfProtection, asyncRoute(async (req, res) => {
    const input = chatInputSchema.safeParse(req.body);
    if (!input.success || input.data.symbols.some(symbol => !ASSET_BY_SYMBOL.has(symbol)) || input.data.focus && (!ASSET_BY_SYMBOL.has(input.data.focus.symbol) || input.data.focus.plan && input.data.focus.plan.symbol !== input.data.focus.symbol)) {
      res.status(400).json({ error: 'Enter a question of 3–1600 characters and select supported instruments. Start a new conversation if the history is too long.', code: 'INVALID_INPUT' });
      return;
    }
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new AIServiceError(503, 'AI_NOT_CONFIGURED', 'The research assistant is unavailable until Gemini is configured on the server.', 'gemini');
    }
    let release: (() => void) | undefined;
    try {
      release = aiSpendingGuard.acquire(getClientId(req, res), isAdminRequest(req, config.ADMIN_DIAGNOSTICS_TOKEN));
    } catch (cause) {
      const error = cause as { status?: number; message: string; code?: string; resetInSeconds?: number };
      if (error.resetInSeconds) res.set('Retry-After', String(error.resetInSeconds));
      res.status(error.status ?? 429).json({ error: error.message, code: error.code, engineStatus: 'unavailable' });
      return;
    }
    try {
      const focus = input.data.focus;
      const [overview, news, candles] = await Promise.allSettled([marketService.overview(), marketService.news(), focus ? marketService.candles(focus.symbol, focus.interval, focus.range) : Promise.resolve(null)]);
      const context = prepareChatContext(overview.status === 'fulfilled' ? overview.value : null, news.status === 'fulfilled' ? news.value : null, focus ? [focus.symbol] : input.data.symbols);
      const series = candles.status === 'fulfilled' ? candles.value : null;
      const chart = focus ? prepareChartEvidence(focus, series ? { ...series, asOf: series.candles.at(-1)?.time ?? null } : null) : null;
      res.json(await chat(input.data, { sources: [...context.sources, ...(chart ? [chart.source] : [])], evidence: { ...context.evidence, chart: chart?.evidence ?? null } }));
    } finally { release?.(); }
  }));

  // Fallthrough for unmatched /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' });
  });

  app.use(apiErrorHandler);
  return app;
}

async function buildContext(symbol?: string) {
  const results = await Promise.allSettled([marketService.overview(), marketService.news()]);
  const overview = results[0].status === 'fulfilled' ? results[0].value : null;
  const news = results[1].status === 'fulfilled' ? results[1].value : null;
  return {
    generatedAt: overview?.generatedAt,
    quotes: overview?.quotes.filter((quote) => !symbol || quote.symbol === symbol),
    news: news?.articles.slice(0, 8),
    newsStatus: news?.status ?? 'unavailable',
  };
}

export const apiErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof AIServiceError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      engine: error.engine,
      engineStatus: 'unavailable',
    });
    return;
  }
  if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413)) {
    res.status(error.status).json({
      error: error.status === 413 ? 'Request body is too large.' : 'Invalid JSON request.',
      code: 'INVALID_INPUT',
    });
    return;
  }
  logger.error('Unhandled request exception', error);
  res.status(500).json({ error: 'The request could not be completed. Please try again.', code: 'INTERNAL_ERROR' });
};
