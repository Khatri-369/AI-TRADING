import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { ServerConfig } from './config';
import { marketService } from './market/index';
import { liveStreamManager } from './market/liveStream';
import { analyze, scenario, aiProviderStatuses, AIServiceError } from './ai/index';
import { ASSET_BY_SYMBOL, HISTORY_RANGES } from '../shared/assets';

const headlineInput = z.object({
  headline: z.string().trim().min(5).max(2000),
  engine: z.enum(['gemini', 'finbert']).default('gemini'),
  symbol: z.string().max(30).refine((value) => ASSET_BY_SYMBOL.has(value), 'Unknown asset').optional(),
}).strict();
const scenarioInput = z.object({ scenario: z.string().trim().min(10).max(2000) }).strict();
const historyRange = z.enum(HISTORY_RANGES);
const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function createApp(config: ServerConfig, production = config.NODE_ENV === 'production') {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet({
    contentSecurityPolicy: production ? {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"], fontSrc: ["'self'"], objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    } : false,
    strictTransportSecurity: production ? undefined : false,
  }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many requests. Try again shortly.', code: 'RATE_LIMITED' } }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', generatedAt: new Date().toISOString(),
      providers: [...marketService.providerStatuses(), ...aiProviderStatuses()],
      aiAccess: config.AI_ACCESS_TOKEN ? 'protected' : production ? 'disabled' : 'local',
    });
  });
  app.get('/api/markets/overview', asyncRoute(async (_req, res) => { res.json(await marketService.overview()); }));
  for (const category of ['us', 'india', 'crypto', 'commodities', 'forex']) {
    app.get(`/api/markets/${category}`, asyncRoute(async (_req, res) => {
      const overview = await marketService.overview();
      res.json({ ...overview, quotes: overview.quotes.filter((quote) => quote.category === category) });
    }));
  }
  app.get('/api/markets/history/:symbol', asyncRoute(async (req, res) => {
    const symbol = String(req.params.symbol);
    if (!ASSET_BY_SYMBOL.has(symbol)) { res.status(404).json({ error: 'Unknown asset.', code: 'UNKNOWN_ASSET' }); return; }
    const range = historyRange.safeParse(req.query.range ?? '1M');
    if (!range.success) { res.status(400).json({ error: 'Unsupported history range.', code: 'INVALID_INPUT' }); return; }
    res.json(await marketService.history(symbol, range.data));
  }));
  liveStreamManager.start();
  app.get('/api/stream/live-ticks', (_req, res) => { liveStreamManager.addClient(res); });
  app.get('/api/news', asyncRoute(async (_req, res) => { res.json(await marketService.news()); }));
  app.use('/api/ai', (req, res, next) => {
    // This application access token protects paid quota; it is never a provider key.
    if (!config.AI_ACCESS_TOKEN) {
      if (!production) { next(); return; }
      res.status(503).json({ error: 'AI access is disabled until the server administrator configures AI_ACCESS_TOKEN.', code: 'AI_ACCESS_DISABLED', engineStatus: 'unavailable' }); return;
    }
    const supplied = Buffer.from(req.get('authorization')?.replace(/^Bearer /, '') ?? '');
    const expected = Buffer.from(config.AI_ACCESS_TOKEN);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.status(401).json({ error: 'An application access token is required for AI requests.', code: 'AI_ACCESS_REQUIRED', engineStatus: 'unavailable' }); return;
    }
    next();
  });
  app.use('/api/ai', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'AI request limit reached. Try again in a minute.', code: 'RATE_LIMITED', engineStatus: 'unavailable' } }));
  app.post('/api/ai/analyze', asyncRoute(async (req, res) => {
    const input = headlineInput.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: 'Provide a headline (5–2000 characters), a supported engine and optional known symbol.', code: 'INVALID_INPUT' }); return; }
    const context = input.data.engine === 'gemini' && process.env.GEMINI_API_KEY ? await buildContext(input.data.symbol) : undefined;
    res.json(await analyze(input.data, context));
  }));
  app.post('/api/ai/scenario', asyncRoute(async (req, res) => {
    const input = scenarioInput.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: 'Provide a scenario of 10–2000 characters.', code: 'INVALID_INPUT' }); return; }
    res.json(await scenario(input.data, process.env.GEMINI_API_KEY ? await buildContext() : undefined));
  }));
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' }); });
  app.use(apiErrorHandler);
  return app;
}

async function buildContext(symbol?: string) {
  const results = await Promise.allSettled([marketService.overview(), marketService.news()]);
  const overview = results[0].status === 'fulfilled' ? results[0].value : null;
  const news = results[1].status === 'fulfilled' ? results[1].value : null;
  return { generatedAt: overview?.generatedAt,
    quotes: overview?.quotes.filter((quote) => !symbol || quote.symbol === symbol),
    news: news?.articles.slice(0, 8), newsStatus: news?.status ?? 'unavailable' };
}

export const apiErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof AIServiceError) {
    res.status(error.status).json({ error: error.message, code: error.code, engine: error.engine, engineStatus: 'unavailable' }); return;
  }
  if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413)) {
    res.status(error.status).json({ error: error.status === 413 ? 'Request body is too large.' : 'Invalid JSON request.', code: 'INVALID_INPUT' }); return;
  }
  console.error('Request failed unexpectedly.');
  res.status(500).json({ error: 'The request could not be completed. Please try again.', code: 'INTERNAL_ERROR' });
};
