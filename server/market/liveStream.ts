import type { Request, Response } from 'express';
import { marketService } from './index';
import { metrics } from '../metrics';
import { logger } from '../logger';

/**
 * Production SSE Stream Manager.
 * Connects one server-side Upstox WebSocket feed and relays updates to verified browser clients.
 * Enforces per-IP limits, total capacity limits, non-buffering headers, heartbeats, and graceful drainage.
 */
export class LiveStreamManager {
  private clients = new Set<Response>();
  private ipConnections = new Map<string, number>();
  private disconnect?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private maxClients = 100;
  private maxPerIp = 5;

  setMaxClients(limit: number) {
    this.maxClients = limit;
  }

  addClient(req: Request, res: Response) {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Global capacity check
    if (this.clients.size >= this.maxClients) {
      res.status(503).json({
        error: 'Live telemetry stream capacity reached. Falling back to HTTP polling.',
        code: 'STREAM_CAPACITY_REACHED',
      });
      return;
    }

    // Per-IP concurrency check
    const currentForIp = this.ipConnections.get(clientIp) ?? 0;
    if (currentForIp >= this.maxPerIp) {
      res.status(429).json({
        error: 'Too many concurrent stream connections from this IP.',
        code: 'STREAM_RATE_LIMITED',
      });
      return;
    }

    this.ipConnections.set(clientIp, currentForIp + 1);

    // Essential reverse proxy and SSE headers
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Instructs Nginx reverse proxy not to buffer SSE stream chunks
    });

    res.flushHeaders();
    res.write(': connected\n\n');
    this.clients.add(res);
    metrics.setSSEClientCount(this.clients.size);

    if (!this.disconnect) {
      logger.info('Subscribing to market live feed for active SSE subscribers.');
      this.disconnect = marketService.subscribe((quote) => {
        metrics.recordTickStreamed();
        const payload = `data: ${JSON.stringify(quote)}\n\n`;
        for (const client of this.clients) {
          if (!client.write(payload)) {
            client.end();
          }
        }
      });

      // 15-second heartbeat ping to prevent proxy/NAT timeout disconnects
      this.timer = setInterval(() => {
        for (const client of this.clients) {
          if (!client.write(': ping\n\n')) {
            client.end();
          }
        }
      }, 15_000);
      this.timer.unref();
    }

    res.on('close', () => {
      this.clients.delete(res);
      const remainingForIp = Math.max(0, (this.ipConnections.get(clientIp) ?? 1) - 1);
      if (remainingForIp === 0) {
        this.ipConnections.delete(clientIp);
      } else {
        this.ipConnections.set(clientIp, remainingForIp);
      }
      metrics.setSSEClientCount(this.clients.size);

      if (!this.clients.size) {
        logger.info('All SSE clients disconnected; idling stream.');
        this.stop();
      }
    });
  }

  stop() {
    this.disconnect?.();
    this.disconnect = undefined;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    for (const client of this.clients) {
      try {
        client.write(': server-shutdown\n\n');
        client.end();
      } catch {
        // Safe ignore
      }
    }
    this.clients.clear();
    this.ipConnections.clear();
    metrics.setSSEClientCount(0);
    marketService.stopStreaming();
  }
}

export const liveStreamManager = new LiveStreamManager();
