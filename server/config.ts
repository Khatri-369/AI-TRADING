import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  AI_ACCESS_TOKEN: z.string().optional(),
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
    throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  for (const key of ['GEMINI_API_KEY', 'FINNHUB_API_KEY', 'UPSTOX_ANALYTICS_TOKEN', 'HUGGINGFACE_API_KEY', 'COINGECKO_DEMO_API_KEY', 'GOLD_API_KEY'] as const) {
    const value = result.data[key];
    if (value && (/^(MY_|your_|replace_|placeholder)/i.test(value) || value !== value.trim())) {
      throw new Error(`Invalid environment configuration: ${key} must be a real credential without surrounding whitespace, or empty.`);
    }
  }
  return result.data;
}
export type ServerConfig = ReturnType<typeof readConfig>;
