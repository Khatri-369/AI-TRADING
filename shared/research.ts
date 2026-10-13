import { z } from 'zod';
export const intervals = ['5m', '30m', '1d'] as const;
export const candleSchema = z.object({ time: z.string().datetime(), open: z.number().positive(), high: z.number().positive(), low: z.number().positive(), close: z.number().positive(), volume: z.number().nonnegative().nullable() }).refine(c => c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close), 'Invalid candle');
export type Candle = z.infer<typeof candleSchema>;
const anchor = z.object({ time: z.number().finite(), price: z.number().positive() });
export const drawingSchema = z.object({ id: z.string().max(80), type: z.enum(['level', 'trend', 'zone', 'text']), a: anchor, b: anchor.optional(), text: z.string().max(120).default(''), locked: z.boolean().default(false) });
export type Drawing = z.infer<typeof drawingSchema>;
export const planSchema = z.object({ symbol: z.string().max(30), direction: z.enum(['long', 'short']), entry: z.number().positive(), stop: z.number().positive(), target: z.number().positive(), quantity: z.number().positive().max(1000000), costs: z.number().nonnegative().max(100000000), thesis: z.string().max(2000), invalidation: z.string().max(2000), status: z.enum(['draft', 'watching', 'archived', 'reviewed']).default('draft') }).refine(p => p.direction === 'long' ? p.stop < p.entry && p.target > p.entry : p.stop > p.entry && p.target < p.entry, 'Stop and target must be on the correct sides of entry');
export type Plan = z.infer<typeof planSchema>;
export function planMetrics(p: Plan) { const distance = Math.abs(p.entry - p.stop); const loss = distance * p.quantity + p.costs; const reward = Math.abs(p.target - p.entry) * p.quantity - p.costs; return { distance, loss, reward, ratio: reward / loss }; }
export const journalSchema = z.object({ symbol: z.string().max(30), direction: z.enum(['long', 'short']), entry: z.number().positive(), exit: z.number().positive(), quantity: z.number().positive().max(1000000), costs: z.number().nonnegative(), openedAt: z.string().datetime(), closedAt: z.string().datetime(), notes: z.string().max(2000), followedPlan: z.boolean(), tags: z.string().max(160), planId: z.string().max(80).optional() }).refine(j => j.closedAt >= j.openedAt, 'Exit date must follow entry');
export type Journal = z.infer<typeof journalSchema>;
export function journalPnl(j: Journal) { return (j.exit - j.entry) * (j.direction === 'long' ? 1 : -1) * j.quantity - j.costs; }
export const alertSchema = z.object({ symbol: z.string().max(30), direction: z.enum(['above', 'below']), level: z.number().positive(), paused: z.boolean().default(false), expiresAt: z.string().datetime(), timezone: z.string().max(60).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }), quietStart: z.number().int().min(0).max(23), quietEnd: z.number().int().min(0).max(23) });
export type PriceAlert = z.infer<typeof alertSchema>;
export const chartLayoutSchema = z.object({ symbol: z.string().max(30), name: z.string().min(1).max(60), interval: z.enum(intervals), drawings: z.array(drawingSchema).max(50) });
export const recordSchemas = { chart: chartLayoutSchema, plan: planSchema, journal: journalSchema, alert: alertSchema, watchlist: z.object({ symbols: z.array(z.string().max(30)).max(100) }) };
export type RecordKind = keyof typeof recordSchemas;
export type ResearchRecord = { id: string; kind: RecordKind; version: number; data: unknown; updatedAt: string };
export function movingAverage(candles: Candle[], period: number, exponential = false) {
  if (!Number.isInteger(period) || period < 2) return [];
  const result: { time: string; value: number }[] = []; let previous: number | undefined;
  for (let i = period - 1; i < candles.length; i++) {
    const mean = candles.slice(i + 1 - period, i + 1).reduce((sum, c) => sum + c.close, 0) / period;
    previous = exponential && previous !== undefined ? candles[i].close * (2 / (period + 1)) + previous * (1 - 2 / (period + 1)) : mean;
    result.push({ time: candles[i].time, value: previous });
  }
  return result;
}
