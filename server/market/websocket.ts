import path from 'node:path';
import { fileURLToPath } from 'node:url';
import protobuf from 'protobufjs';
import WebSocket from 'ws';
import type { SourceQuote } from './providers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type WebSocketStatus = 'unconfigured' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface UpstoxFeedUpdate {
  instrumentKey: string;
  lastPrice: number;
  closePrice?: number;
  change?: number;
  changePercent?: number;
  timestamp: string;
}

export class UpstoxWebSocketClient {
  private ws: WebSocket | null = null;
  private feedResponseType: protobuf.Type | null = null;
  private status: WebSocketStatus = 'unconfigured';
  private statusMessage = 'Set UPSTOX_ANALYTICS_TOKEN to enable real-time Upstox WebSocket market feed.';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isExplicitlyStopped = false;
  private subscribedKeys: string[] = [];

  constructor(
    private readonly token: string | undefined = process.env.UPSTOX_ANALYTICS_TOKEN,
    private readonly onTick?: (update: UpstoxFeedUpdate) => void
  ) {}

  getStatus() {
    return {
      status: this.status,
      message: this.statusMessage,
      configured: !!this.token,
    };
  }

  private async loadProtoSchema(): Promise<protobuf.Type> {
    if (this.feedResponseType) return this.feedResponseType;
    const protoPath = path.join(__dirname, 'MarketDataFeed.proto');
    const root = await protobuf.load(protoPath);
    this.feedResponseType = root.lookupType('com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse');
    return this.feedResponseType;
  }

  async start(instrumentKeys: string[] = []): Promise<void> {
    this.isExplicitlyStopped = false;
    this.subscribedKeys = instrumentKeys;

    if (!this.token) {
      this.status = 'unconfigured';
      this.statusMessage = 'Set UPSTOX_ANALYTICS_TOKEN to enable real-time Upstox WebSocket market feed.';
      return;
    }

    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isExplicitlyStopped) return;

    try {
      this.status = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
      this.statusMessage = 'Authorizing Upstox WebSocket feed...';

      // 1. Authorize WebSocket session via Upstox API
      const authRes = await fetch('https://api.upstox.com/v3/feed/market-data-feed/authorize', {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!authRes.ok) {
        throw new Error(`Upstox WebSocket auth failed with HTTP ${authRes.status}: ${authRes.statusText}`);
      }

      const authData = (await authRes.json()) as { status: string; data?: { authorizedRedirectUri?: string } };
      const wsUrl = authData.data?.authorizedRedirectUri;
      if (!wsUrl) {
        throw new Error('Upstox WebSocket authorization response did not contain authorizedRedirectUri');
      }

      const FeedResponse = await this.loadProtoSchema();

      // 2. Open WebSocket
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.status = 'connected';
        this.statusMessage = `Connected to Upstox Market Data Feed; active since ${new Date().toISOString()}`;
        this.reconnectAttempts = 0;

        // Subscribe to instruments if keys were supplied
        if (this.subscribedKeys.length > 0) {
          this.subscribe(this.subscribedKeys);
        }
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const decoded = FeedResponse.decode(new Uint8Array(buffer)) as any;

          if (decoded && decoded.feeds) {
            for (const [instrumentKey, feed] of Object.entries(decoded.feeds as Record<string, any>)) {
              const ltpc = feed.ltpc || feed.fullFeed?.marketFF?.ltpc || feed.fullFeed?.indexFF?.ltpc;
              if (!ltpc || typeof ltpc.ltp !== 'number') continue;

              const lastPrice = ltpc.ltp;
              const closePrice = typeof ltpc.cp === 'number' && ltpc.cp > 0 ? ltpc.cp : undefined;
              const change = closePrice ? lastPrice - closePrice : undefined;
              const changePercent = closePrice && closePrice > 0 && change !== undefined ? (change / closePrice) * 100 : undefined;
              const timestamp = ltpc.ltt ? new Date(Number(ltpc.ltt)).toISOString() : new Date().toISOString();

              this.onTick?.({
                instrumentKey,
                lastPrice,
                closePrice,
                change,
                changePercent,
                timestamp,
              });
            }
          }
        } catch (err) {
          console.warn('Failed to decode Upstox WebSocket protobuf frame:', err);
        }
      });

      this.ws.on('error', (err) => {
        this.status = 'error';
        this.statusMessage = `Upstox WebSocket error: ${err.message}`;
      });

      this.ws.on('close', () => {
        if (!this.isExplicitlyStopped) {
          this.status = 'disconnected';
          this.scheduleReconnect();
        }
      });
    } catch (err: any) {
      this.status = 'error';
      this.statusMessage = err?.message || 'Upstox WebSocket connection failed';
      this.scheduleReconnect();
    }
  }

  subscribe(instrumentKeys: string[]): void {
    this.subscribedKeys = instrumentKeys;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && instrumentKeys.length > 0) {
      const payload = {
        guid: `req-${Date.now()}`,
        method: 'sub',
        data: {
          mode: 'ltpc',
          instrumentKeys,
        },
      };
      this.ws.send(JSON.stringify(payload));
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyStopped || this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(30_000, 2_000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  stop(): void {
    this.isExplicitlyStopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.status = 'disconnected';
    this.statusMessage = 'Upstox WebSocket feed stopped.';
  }
}
