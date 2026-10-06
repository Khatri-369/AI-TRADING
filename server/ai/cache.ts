import { createHash } from 'node:crypto';

interface CacheRecord<T> { value: T; expiresAt: number }

/** Successful results only; shared requests and LRU eviction bound quota and memory. */
export class AIResultCache<T extends { cached: boolean }> {
  private readonly records = new Map<string, CacheRecord<T>>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(
    private readonly now: () => number,
    private readonly capacity = 200,
    private readonly maxPending = 12,
  ) {}

  async get(key: string, ttlMs: number, produce: () => Promise<T>, busy: () => Error): Promise<T> {
    const existing = this.records.get(key);
    if (existing && existing.expiresAt > this.now()) {
      this.records.delete(key);
      this.records.set(key, existing);
      return { ...structuredClone(existing.value), cached: true };
    }
    this.records.delete(key);
    const pending = this.pending.get(key);
    if (pending) return { ...structuredClone(await pending), cached: true };
    if (this.pending.size >= this.maxPending) throw busy();

    const promise = produce();
    this.pending.set(key, promise);
    try {
      const value = await promise;
      for (const [cacheKey, record] of this.records) {
        if (record.expiresAt <= this.now()) this.records.delete(cacheKey);
      }
      while (this.records.size >= this.capacity) {
        const oldest = this.records.keys().next().value;
        if (oldest === undefined) break;
        this.records.delete(oldest);
      }
      this.records.set(key, { value: structuredClone(value), expiresAt: this.now() + ttlMs });
      return value;
    } finally {
      this.pending.delete(key);
    }
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      // Receipt/cache bookkeeping does not change evidence. Preserve observation
      // times (asOf/publishedAt), prices, sessions and stale/unavailable status.
      .filter(([key]) => !['generatedAt', 'fetchedAt', 'cached'].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function hashRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}
