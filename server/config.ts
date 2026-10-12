import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  // Session & Admin security
  SESSION_SECRET: z.string().min(16).default('development-session-secret-key-min-16-chars'),
  ADMIN_DIAGNOSTICS_TOKEN: z.string().optional(),
  AI_ACCESS_TOKEN: z.string().optional(), // Kept as alias for ADMIN_DIAGNOSTICS_TOKEN for backwards-compat

  // AI spending limits & quotas
  AI_DAILY_BUDGET_LIMIT: z.coerce.number().int().min(1).default(100),
  AI_PER_CLIENT_DAILY_LIMIT: z.coerce.number().int().min(1).default(5),
  ANONYMOUS_AI_QUOTA_ENABLED: z
    .preprocess((val) => (typeof val === 'string' ? val.toLowerCase() === 'true' || val === '1' : Boolean(val ?? true)), z.boolean())
    .default(true),

  // SSE streaming capacity
  SSE_MAX_CLIENTS: z.coerce.number().int().min(5).max(1000).default(100),

  // Provider credentials
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional(),
  FINNHUB_API_KEY: z.string().optional(),
  UPSTOX_ANALYTICS_TOKEN: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  COINGECKO_DEMO_API_KEY: z.string().optional(),
  GOLD_API_KEY: z.string().optional(),
  GOLD_CACHE_SECONDS: z.coerce.number().int().min(60).default(86400),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ')}`
    );
  }

  const data = result.data;

  // Unify ADMIN_DIAGNOSTICS_TOKEN with AI_ACCESS_TOKEN fallback
  if (!data.ADMIN_DIAGNOSTICS_TOKEN && data.AI_ACCESS_TOKEN) {
    data.ADMIN_DIAGNOSTICS_TOKEN = data.AI_ACCESS_TOKEN;
  }

  // Validate placeholder secrets safely without echoing their contents
  for (const key of [
    'GEMINI_API_KEY',
    'FINNHUB_API_KEY',
    'UPSTOX_ANALYTICS_TOKEN',
    'HUGGINGFACE_API_KEY',
    'COINGECKO_DEMO_API_KEY',
    'GOLD_API_KEY',
    'ADMIN_DIAGNOSTICS_TOKEN',
  ] as const) {
    const value = data[key];
    if (value && (/^(MY_|your_|replace_|placeholder|test_token)/i.test(value) || value !== value.trim())) {
      throw new Error(
        `Invalid environment configuration: ${key} must be a real credential without surrounding whitespace, or empty.`
      );
    }
  }

  // Production security checks
  if (data.NODE_ENV === 'production') {
    if (data.SESSION_SECRET === 'development-session-secret-key-min-16-chars') {
      throw new Error(
        'Production configuration error: SESSION_SECRET must be set to a high-entropy string of at least 16 characters in production.'
      );
    }
  }

  return data;
}

export type ServerConfig = ReturnType<typeof readConfig>;
