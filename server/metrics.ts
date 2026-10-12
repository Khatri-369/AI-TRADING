/**
 * In-memory production metrics collector.
 * Bounded storage, safe from memory leaks, strictly sanitized.
 */

export interface ProviderMetric {
  calls: number;
  errors: number;
  lastLatencyMs: number;
  lastCallAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

export class MetricsCollector {
  private startTime = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;
  private providerMetrics = new Map<string, ProviderMetric>();
  private activeSSEClients = 0;
  private peakSSEClients = 0;
  private totalTicksStreamed = 0;

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  recordRequest(isError = false) {
    this.totalRequests++;
    if (isError) this.totalErrors++;
  }

  recordProviderCall(providerId: string, latencyMs: number, error?: string | null) {
    const current = this.providerMetrics.get(providerId) ?? {
      calls: 0,
      errors: 0,
      lastLatencyMs: 0,
      lastCallAt: null,
      lastErrorAt: null,
      lastError: null,
    };

    current.calls++;
    current.lastLatencyMs = latencyMs;
    current.lastCallAt = new Date().toISOString();

    if (error) {
      current.errors++;
      current.lastErrorAt = new Date().toISOString();
      current.lastError = error.slice(0, 200); // Bounded length
    }

    this.providerMetrics.set(providerId, current);
  }

  setSSEClientCount(count: number) {
    this.activeSSEClients = count;
    if (count > this.peakSSEClients) {
      this.peakSSEClients = count;
    }
  }

  recordTickStreamed() {
    this.totalTicksStreamed++;
  }

  getSanitizedSummary() {
    return {
      uptimeSeconds: this.getUptimeSeconds(),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      activeSSEClients: this.activeSSEClients,
      peakSSEClients: this.peakSSEClients,
      totalTicksStreamed: this.totalTicksStreamed,
    };
  }

  getDetailedDiagnostics() {
    const memory = process.memoryUsage();
    return {
      ...this.getSanitizedSummary(),
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
      },
      providers: Object.fromEntries(this.providerMetrics.entries()),
    };
  }
}

export const metrics = new MetricsCollector();
