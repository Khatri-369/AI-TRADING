/**
 * AI Spending Guard & Quota Manager.
 * Controls API costs, prevents runaway billing on cloud providers (Gemini/HuggingFace),
 * and enforces per-client anonymous quotas + strict concurrency limits.
 */

export interface QuotaStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  resetInSeconds: number;
  reason?: string;
  isAdmin?: boolean;
}

export class AISpendingGuard {
  private dailyBudgetLimit: number;
  private maxConcurrent: number;
  private perClientDailyLimit: number;

  // Global daily usage
  private globalDailyCount = 0;
  private currentDay = new Date().toISOString().slice(0, 10);

  // In-flight concurrency
  private inFlight = 0;

  // Per-client usage (sliding 24h window)
  // Map<clientId, timestamp[]>
  private clientUsage = new Map<string, number[]>();

  constructor(options?: {
    dailyBudgetLimit?: number;
    maxConcurrent?: number;
    perClientDailyLimit?: number;
  }) {
    this.dailyBudgetLimit = options?.dailyBudgetLimit ?? 100;
    this.maxConcurrent = options?.maxConcurrent ?? 2;
    this.perClientDailyLimit = options?.perClientDailyLimit ?? 5;
  }

  private rollDayIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDay) {
      this.currentDay = today;
      this.globalDailyCount = 0;
    }
  }

  private cleanClientHistory(now: number) {
    const cutoff = now - 24 * 60 * 60 * 1000;
    // Bounded cleanup
    if (this.clientUsage.size > 5000) {
      for (const [key, timestamps] of this.clientUsage.entries()) {
        const filtered = timestamps.filter(t => t > cutoff);
        if (filtered.length === 0) {
          this.clientUsage.delete(key);
        } else {
          this.clientUsage.set(key, filtered);
        }
      }
    }
  }

  /**
   * Check quota for a client without consuming it.
   */
  checkQuota(clientId: string, isAdmin = false): QuotaStatus {
    if (isAdmin) {
      return {
        allowed: true,
        limit: Infinity,
        remaining: Infinity,
        resetAt: new Date(Date.now() + 86400000).toISOString(),
        resetInSeconds: 86400,
        isAdmin: true,
      };
    }

    this.rollDayIfNeeded();
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    // Check global server budget
    if (this.globalDailyCount >= this.dailyBudgetLimit) {
      return {
        allowed: false,
        limit: this.perClientDailyLimit,
        remaining: 0,
        resetAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
        resetInSeconds: Math.floor((new Date().setUTCHours(24, 0, 0, 0) - now) / 1000),
        reason: 'GLOBAL_DAILY_BUDGET_EXHAUSTED',
      };
    }

    // Check in-flight concurrency
    if (this.inFlight >= this.maxConcurrent) {
      return {
        allowed: false,
        limit: this.perClientDailyLimit,
        remaining: 0,
        resetAt: new Date(now + 5000).toISOString(),
        resetInSeconds: 5,
        reason: 'CONCURRENCY_LIMIT_REACHED',
      };
    }

    // Check per-client quota
    const timestamps = (this.clientUsage.get(clientId) ?? []).filter(t => t > cutoff);
    const count = timestamps.length;
    const remaining = Math.max(0, this.perClientDailyLimit - count);

    const oldest = timestamps[0] ?? now;
    const resetTime = oldest + 24 * 60 * 60 * 1000;
    const resetInSeconds = Math.max(1, Math.floor((resetTime - now) / 1000));

    return {
      allowed: remaining > 0,
      limit: this.perClientDailyLimit,
      remaining,
      resetAt: new Date(resetTime).toISOString(),
      resetInSeconds,
      reason: remaining > 0 ? undefined : 'CLIENT_DAILY_QUOTA_EXHAUSTED',
    };
  }

  /**
   * Acquire execution slot for an AI request.
   * Throws if quota or concurrency limit is violated.
   */
  acquire(clientId: string, isAdmin = false): () => void {
    const status = this.checkQuota(clientId, isAdmin);
    if (!status.allowed) {
      const err = new Error(
        status.reason === 'GLOBAL_DAILY_BUDGET_EXHAUSTED'
          ? 'Global daily AI compute budget reached. Please try again tomorrow.'
          : status.reason === 'CONCURRENCY_LIMIT_REACHED'
          ? 'AI engine is currently handling concurrent evaluations. Please retry in a few seconds.'
          : `Daily AI quota reached (${this.perClientDailyLimit} queries per 24 hours). Resets in ${Math.ceil(
              status.resetInSeconds / 3600
            )} hours.`
      );
      (err as unknown as { code: string; status: number; resetInSeconds: number }).code =
        status.reason ?? 'QUOTA_EXHAUSTED';
      (err as unknown as { code: string; status: number; resetInSeconds: number }).status =
        status.reason === 'CONCURRENCY_LIMIT_REACHED' ? 429 : status.reason === 'GLOBAL_DAILY_BUDGET_EXHAUSTED' ? 503 : 429;
      (err as unknown as { code: string; status: number; resetInSeconds: number }).resetInSeconds =
        status.resetInSeconds;
      throw err;
    }

    this.inFlight++;
    if (!isAdmin) {
      this.globalDailyCount++;
      const now = Date.now();
      const cutoff = now - 24 * 60 * 60 * 1000;
      const history = (this.clientUsage.get(clientId) ?? []).filter(t => t > cutoff);
      history.push(now);
      this.clientUsage.set(clientId, history);
      this.cleanClientHistory(now);
    }

    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.inFlight = Math.max(0, this.inFlight - 1);
      }
    };
  }

  getSpendingMetrics() {
    this.rollDayIfNeeded();
    return {
      globalDailyCount: this.globalDailyCount,
      dailyBudgetLimit: this.dailyBudgetLimit,
      inFlight: this.inFlight,
      maxConcurrent: this.maxConcurrent,
      perClientDailyLimit: this.perClientDailyLimit,
      trackedClients: this.clientUsage.size,
    };
  }
}

export const aiSpendingGuard = new AISpendingGuard();
