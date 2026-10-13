import { z } from 'zod';
import { chatResultSchema, type ChatInput } from '../../shared/chat';
import { candleSchema } from '../../shared/research';
import type { AIAnalysis, Engine, HistoryRange, ScenarioResult } from '../types/market';

const finite = z.number().finite();
const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
const status = z.enum(['live', 'delayed', 'cached', 'stale', 'unavailable']);
const metadata = { provider: z.string(), status, fetchedAt: timestamp.nullable(), cached: z.boolean(), error: z.string().optional() };

export const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  category: z.enum(['us', 'india', 'crypto', 'commodities', 'forex']),
  currency: z.string(),
  sector: z.string().optional(),
  price: finite.nullable(),
  change: finite.nullable(),
  changePercent: finite.nullable(),
  volume: finite.nullable(),
  asOf: timestamp.nullable(),
  ...metadata,
  session: z.object({
    state: z.enum(['OPEN', 'CLOSED', 'PRE-MARKET', 'AFTER-HOURS', 'UNKNOWN']),
    timezone: z.string(),
    note: z.string().optional(),
  }),
});

const overviewSchema = z.object({ quotes: z.array(quoteSchema), generatedAt: timestamp });
const newsSchema = z.object({
  articles: z.array(
    z.object({
      id: z.string(),
      headline: z.string(),
      source: z.string(),
      url: z.string(),
      publishedAt: timestamp,
      summary: z.string(),
      relatedAssets: z.array(z.string()),
    })
  ),
  ...metadata,
});

export const healthSchema = z.object({
  status: z.string(),
  aiAccess: z.string(),
  version: z.string().optional(),
  uptimeSeconds: z.number().optional(),
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      message: z.string().optional(),
      configured: z.boolean().optional(),
    })
  ),
});

const historySchema = z.object({
  symbol: z.string(),
  range: z.string(),
  currency: z.string(),
  points: z.array(z.object({ time: timestamp, price: finite })),
  ...metadata,
});

const analysisSchema = z.object({
  sentiment: z.enum(['Positive', 'Negative', 'Neutral']),
  signal: z.enum(['Buy', 'Sell', 'Hold']),
  confidence: finite.min(0).max(100),
  rationale: z.string(),
  risks: z.array(z.string()),
  affectedAssets: z.array(z.string()),
  engine: z.string(),
  engineStatus: z.literal('available'),
  generatedAt: timestamp,
  cached: z.boolean(),
});

const scenarioSchema = z.object({
  scenario: z.string(),
  summary: z.string(),
  impacts: z.array(
    z.object({
      symbol: z.string(),
      direction: z.enum(['up', 'down', 'mixed']),
      estimatedChangePercent: finite.nullable(),
      rationale: z.string(),
    })
  ),
  risks: z.array(z.string()),
  engine: z.string(),
  engineStatus: z.literal('available'),
  generatedAt: timestamp,
  hypothetical: z.literal(true),
  cached: z.boolean(),
});

export const quotaSchema = z.object({
  allowed: z.boolean(),
  limit: z.number(),
  remaining: z.number(),
  resetAt: z.string(),
  resetInSeconds: z.number(),
  isAdmin: z.boolean().optional(),
});
export type AIQuota = z.infer<typeof quotaSchema>;

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let applicationToken = '';
export const setApplicationToken = (token: string) => {
  applicationToken = token;
};
export const getApplicationToken = () => applicationToken;

async function request<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, body ? 65_000 : 45_000);

  if (signal.aborted) controller.abort();

  try {
    const response = await fetch(path, {
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined
          ? {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest', // Anti-CSRF verification header
              ...(applicationToken ? { Authorization: `Bearer ${applicationToken}` } : {}),
            }
          : {}),
      },
      ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error = z.object({ error: z.string(), code: z.string().optional() }).safeParse(payload);
      throw new ApiError(
        error.success ? error.data.error : `Request failed (${response.status}). Please try again.`,
        response.status,
        error.success ? error.data.code : undefined
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        'The server returned an invalid response. No replacement data has been generated.',
        502,
        'INVALID_RESPONSE'
      );
    }
    return parsed.data;
  } catch (error) {
    if (timedOut) throw new ApiError('The request timed out. Please try again.', 504, 'TIMEOUT');
    if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export const getOverview = (signal: AbortSignal) => request('/api/markets/overview', overviewSchema, signal);
export const candlesResponseSchema = z.object({ symbol: z.string(), interval: z.enum(['5m', '30m', '1d']), range: z.string(), currency: z.string(), timezone: z.string(), provider: z.string(), candles: z.array(candleSchema), fetchedAt: z.string().nullable(), status: z.string(), cached: z.boolean(), note: z.string() });
export const getCandles = (symbol: string, interval: string, range: string, signal: AbortSignal) => request(`/api/markets/candles/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`, candlesResponseSchema, signal);
export const askResearch = (body: ChatInput, signal: AbortSignal) => request('/api/ai/chat', chatResultSchema, signal, body);
export const getNews = (signal: AbortSignal) => request('/api/news', newsSchema, signal);
export const getHealth = (signal: AbortSignal) => request('/api/health', healthSchema, signal);
export const getQuota = (signal: AbortSignal): Promise<AIQuota> => request('/api/ai/quota', quotaSchema, signal);
export const getHistory = (symbol: string, range: HistoryRange, signal: AbortSignal) =>
  request(`/api/markets/history/${encodeURIComponent(symbol)}?range=${range}`, historySchema, signal);
export const analyze = (
  body: { headline: string; engine: Engine; symbol?: string },
  signal: AbortSignal
): Promise<AIAnalysis> => request('/api/ai/analyze', analysisSchema, signal, body);
export const simulate = (scenario: string, signal: AbortSignal): Promise<ScenarioResult> =>
  request('/api/ai/scenario', scenarioSchema, signal, { scenario });

export async function getAdminDiagnostics(token: string, signal: AbortSignal) {
  const response = await fetch('/api/admin/diagnostics', {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!response.ok) {
    throw new ApiError(`Administrative authorization failed (${response.status}).`, response.status);
  }
  return response.json();
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'An unexpected error occurred.');
export const safeArticleUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
