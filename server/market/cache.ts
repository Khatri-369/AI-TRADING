export interface CachedValue<T> {
  value: T;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
  error?: string;
}

/** In-process, bounded cache. Only successful loads advance the source fetch time. */
export class DataCache<T> {
  private values = new Map<string, { value: T; fetched: number }>();
  private pending = new Map<string, Promise<CachedValue<T>>>();
  private failures = new Map<string, { until: number; message: string }>();

  constructor(private readonly now = Date.now, private readonly capacity = 300) {}

  async get(key: string, ttl: number, staleFor: number, loader: () => Promise<T>): Promise<CachedValue<T>> {
    const previous = this.values.get(key);
    const now = this.now();
    const failure = this.failures.get(key);
    const fromCache = (stale: boolean, error?: string): CachedValue<T> => ({
      value: previous!.value, fetchedAt: new Date(previous!.fetched).toISOString(), cached: true, stale,
      ...(error ? { error } : {}),
    });
    if (previous && now - previous.fetched < ttl) return fromCache(false);
    if (failure && now < failure.until) {
      if (previous && now - previous.fetched < ttl + staleFor) return fromCache(true, failure.message);
      throw new Error(failure.message);
    }
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const request = (async (): Promise<CachedValue<T>> => {
      try {
        const value = await loader();
        const fetched = this.now();
        this.values.delete(key);
        this.values.set(key, { value, fetched });
        this.failures.delete(key);
        while (this.values.size > this.capacity) this.values.delete(this.values.keys().next().value!);
        return { value, fetchedAt: new Date(fetched).toISOString(), cached: false, stale: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Provider request failed';
        this.failures.set(key, { until: this.now() + 60_000, message });
        while (this.failures.size > this.capacity) this.failures.delete(this.failures.keys().next().value!);
        if (previous && this.now() - previous.fetched < ttl + staleFor) return fromCache(true, message);
        throw new Error(message, { cause: error });
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, request);
    return request;
  }
}
