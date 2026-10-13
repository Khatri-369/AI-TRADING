import { z } from 'zod';
export const intervals = ['5m', '30m', '1d'] as const;
export const candleSchema = z.object({ time: z.string().datetime(), open: z.number().positive(), high: z.number().positive(), low: z.number().positive(), close: z.number().positive(), volume: z.number().nonnegative().nullable() }).refine(c => c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close), 'Invalid candle');
export type Candle = z.infer<typeof candleSchema>;
const anchor = z.object({ time: z.number().finite(), price: z.number().positive() });
export const drawingSchema = z.object({ id: z.string().max(80), type: z.enum(['level', 'trend', 'zone', 'text']), a: anchor, b: anchor.optional(), text: z.string().max(120).default(''), locked: z.boolean().default(false) });
export type Drawing = z.infer<typeof drawingSchema>;
export const planStatusValues = ['draft', 'watching', 'archived', 'reviewed'] as const;
export type PlanStatus = (typeof planStatusValues)[number];

export const newsLinkSchema = z.object({
  title: z.string().max(120),
  url: z.string().url().max(500),
});
export type NewsLink = z.infer<typeof newsLinkSchema>;

export const planSchema = z
  .object({
    symbol: z.string().max(30),
    exchange: z.string().max(30).optional().default('NSE'),
    currency: z.string().max(10).optional().default('INR'),
    createdAt: z.string().datetime().optional(),
    direction: z.enum(['long', 'short']),
    entry: z.number().positive(),
    stop: z.number().positive(),
    target: z.number().positive(),
    quantity: z.number().positive().max(1000000),
    costs: z.number().nonnegative().max(100000000).default(0),
    feeBps: z.number().nonnegative().max(10000).optional().default(10),
    slippageBps: z.number().nonnegative().max(10000).optional().default(5),
    budget: z.number().positive().max(1000000000).optional(),
    thesis: z.string().max(2000),
    evidence: z.string().max(2000).optional().default(''),
    invalidation: z.string().max(2000),
    newsLinks: z.array(newsLinkSchema).max(10).optional().default([]),
    chartSnapshot: z.string().max(500).optional().default(''),
    status: z.enum(planStatusValues).default('draft'),
  })
  .refine(
    (p) => {
      if (p.entry === p.stop || p.entry === p.target) return false;
      return p.direction === 'long'
        ? p.stop < p.entry && p.target > p.entry
        : p.stop > p.entry && p.target < p.entry;
    },
    'Invalid plan levels: entry and stop cannot be identical, and stop/target must align with direction (long: stop < entry < target; short: target < entry < stop)'
  );
export type Plan = z.infer<typeof planSchema>;
export type PlanInput = z.input<typeof planSchema>;

export function estimatePlanCosts(
  entry: number,
  quantity: number,
  feeBps = 10,
  slippageBps = 5
): number {
  if (entry <= 0 || quantity <= 0) return 0;
  const totalBps = (feeBps + slippageBps) * 2;
  return Number(((entry * quantity * totalBps) / 10000).toFixed(2));
}

export interface BudgetQuantityResult {
  quantity: number;
  lotSize: number;
  costPerUnit: number;
  riskPerUnit: number;
  totalRisk: number;
  supported: boolean;
  limitation?: string;
}

export function calculateQuantityFromBudget(params: {
  symbol: string;
  entry: number;
  stop: number;
  budget: number;
  feeBps?: number;
  slippageBps?: number;
}): BudgetQuantityResult {
  const { symbol, entry, stop, budget, feeBps = 10, slippageBps = 5 } = params;

  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(stop) || stop <= 0) {
    throw new Error('Entry and stop prices must be positive valid numbers.');
  }
  if (entry === stop) {
    throw new Error('Entry and invalidation/stop price cannot be identical (zero distance).');
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('Maximum hypothetical loss budget must be a positive number.');
  }

  const sym = symbol.toUpperCase();
  const isBroadIndex = ['NIFTY50', 'BANKNIFTY', 'SENSEX'].includes(sym);
  if (isBroadIndex) {
    return {
      quantity: 0,
      lotSize: sym === 'BANKNIFTY' ? 15 : sym === 'NIFTY50' ? 25 : 10,
      costPerUnit: 0,
      riskPerUnit: Math.abs(entry - stop),
      totalRisk: 0,
      supported: false,
      limitation: `Broad market index ${symbol} cannot be bought or sold directly as cash equity shares. Index derivatives (standard lot size applicable) or ETF equivalents (e.g., NIFTYBEES) must be used.`,
    };
  }

  const distance = Math.abs(entry - stop);
  const costPerUnit = (entry * (feeBps + slippageBps) * 2) / 10000;
  const riskPerUnit = distance + costPerUnit;

  const lotSize = 1;
  const rawUnits = budget / riskPerUnit;
  const quantity = Math.floor(rawUnits / lotSize) * lotSize;

  if (quantity < lotSize) {
    return {
      quantity: 0,
      lotSize,
      costPerUnit,
      riskPerUnit,
      totalRisk: 0,
      supported: true,
      limitation: `Loss budget of ${budget} is insufficient for 1 whole share at a ${distance.toFixed(2)} price distance plus estimated friction (${costPerUnit.toFixed(2)}). Minimum budget required is ${riskPerUnit.toFixed(2)}.`,
    };
  }

  const totalCosts = Number((quantity * costPerUnit).toFixed(2));
  const totalRisk = Number((quantity * distance + totalCosts).toFixed(2));

  return {
    quantity,
    lotSize,
    costPerUnit,
    riskPerUnit,
    totalRisk,
    supported: true,
  };
}

export function planMetrics(
  p: Pick<PlanInput, 'entry' | 'stop' | 'target' | 'quantity'> &
    Partial<Pick<PlanInput, 'costs' | 'feeBps' | 'slippageBps'>>
) {
  const distance = Math.abs(p.entry - p.stop);
  const targetDistance = Math.abs(p.target - p.entry);
  const feeBps = p.feeBps ?? 10;
  const slippageBps = p.slippageBps ?? 5;
  const costs = p.costs ?? 0;
  const effectiveCosts =
    costs > 0 ? costs : estimatePlanCosts(p.entry, p.quantity, feeBps, slippageBps);
  const loss = distance * p.quantity + effectiveCosts;
  const rawReward = targetDistance * p.quantity - effectiveCosts;
  const reward = Math.max(0, rawReward);
  const ratio = loss > 0 ? reward / loss : 0;
  return {
    distance,
    targetDistance,
    loss,
    reward,
    ratio,
    effectiveCosts,
    costAssumptionRate: ((feeBps + slippageBps) * 2) / 100,
  };
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rate?: number,
  rateTimestamp?: string
): { amount: number; rate: number; timestamp: string } {
  if (from === to) {
    return { amount, rate: 1, timestamp: new Date().toISOString() };
  }
  if (rate === undefined || rate <= 0 || !rateTimestamp) {
    throw new Error(
      `Cannot convert from ${from} to ${to} without an explicit, timestamped exchange conversion rate.`
    );
  }
  return {
    amount: amount * rate,
    rate,
    timestamp: rateTimestamp,
  };
}
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
