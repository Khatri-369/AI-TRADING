import WebSocket from 'ws';
import type { Response } from 'express';

export interface LiveTick {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  timestamp: string;
  provider: 'binance' | 'finnhub';
}

const BINANCE_MAP: Record<string, string> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
};

const US_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY'];

export class LiveStreamManager {
  private binanceWs: WebSocket | null = null;
  private finnhubWs: WebSocket | null = null;
  private subscribers = new Set<Response>();
  private latestTicks = new Map<string, LiveTick>();
  private binanceTimer: NodeJS.Timeout | null = null;
  private finnhubTimer: NodeJS.Timeout | null = null;
  private isStopped = false;

  constructor(private readonly finnhubKey = process.env.FINNHUB_API_KEY) {}

  start() {
    this.isStopped = false;
    this.connectBinance();
    if (this.finnhubKey) {
      this.connectFinnhub();
    }
  }

  private connectBinance() {
    if (this.isStopped) return;
    try {
      const streams = Object.keys(BINANCE_MAP)
        .map((s) => `${s.toLowerCase()}@ticker`)
        .join('/');
      const url = `wss://stream.binance.com:9443/ws/${streams}`;
      this.binanceWs = new WebSocket(url);

      this.binanceWs.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          const symbol = BINANCE_MAP[msg.s];
          if (!symbol) return;

          const price = parseFloat(msg.c);
          const changePercent = parseFloat(msg.P);
          const change = parseFloat(msg.p);
          const volume = parseFloat(msg.q); // 24h quote volume in USD

          if (Number.isFinite(price) && price > 0) {
            const tick: LiveTick = {
              symbol,
              price,
              change,
              changePercent,
              volume,
              timestamp: new Date().toISOString(),
              provider: 'binance',
            };
            this.broadcastTick(tick);
          }
        } catch {
          // Ignore malformed tick frames
        }
      });

      this.binanceWs.on('close', () => {
        if (!this.isStopped) {
          this.scheduleBinanceReconnect();
        }
      });

      this.binanceWs.on('error', () => {
        // Will trigger close event
      });
    } catch {
      this.scheduleBinanceReconnect();
    }
  }

  private scheduleBinanceReconnect() {
    if (this.binanceTimer || this.isStopped) return;
    this.binanceTimer = setTimeout(() => {
      this.binanceTimer = null;
      this.connectBinance();
    }, 5000);
  }

  private connectFinnhub() {
    if (this.isStopped || !this.finnhubKey) return;
    try {
      this.finnhubWs = new WebSocket(`wss://ws.finnhub.io?token=${this.finnhubKey}`);

      this.finnhubWs.on('open', () => {
        if (this.finnhubWs?.readyState === WebSocket.OPEN) {
          for (const sym of US_SYMBOLS) {
            this.finnhubWs.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
          }
        }
      });

      this.finnhubWs.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'trade' && Array.isArray(msg.data)) {
            for (const trade of msg.data) {
              const symbol = trade.s;
              const price = trade.p;
              if (symbol && Number.isFinite(price) && price > 0) {
                const tick: LiveTick = {
                  symbol,
                  price,
                  timestamp: new Date(trade.t || Date.now()).toISOString(),
                  provider: 'finnhub',
                };
                this.broadcastTick(tick);
              }
            }
          }
        } catch {
          // Ignore malformed trade frame
        }
      });

      this.finnhubWs.on('close', () => {
        if (!this.isStopped) {
          this.scheduleFinnhubReconnect();
        }
      });

      this.finnhubWs.on('error', () => {
        // Will trigger close event
      });
    } catch {
      this.scheduleFinnhubReconnect();
    }
  }

  private scheduleFinnhubReconnect() {
    if (this.finnhubTimer || this.isStopped) return;
    this.finnhubTimer = setTimeout(() => {
      this.finnhubTimer = null;
      this.connectFinnhub();
    }, 5000);
  }

  private broadcastTick(tick: LiveTick) {
    this.latestTicks.set(tick.symbol, tick);
    const payload = `data: ${JSON.stringify(tick)}\n\n`;
    for (const res of this.subscribers) {
      try {
        res.write(payload);
      } catch {
        this.subscribers.delete(res);
      }
    }
  }

  getLatestTicks(): LiveTick[] {
    return Array.from(this.latestTicks.values());
  }

  addClient(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial snapshot of all accumulated live ticks
    const snapshot = Array.from(this.latestTicks.values());
    if (snapshot.length > 0) {
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    }

    this.subscribers.add(res);

    // Keepalive ping every 15 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
        this.subscribers.delete(res);
      }
    }, 15000);

    res.on('close', () => {
      clearInterval(pingInterval);
      this.subscribers.delete(res);
    });
  }

  stop() {
    this.isStopped = true;
    if (this.binanceTimer) clearTimeout(this.binanceTimer);
    if (this.finnhubTimer) clearTimeout(this.finnhubTimer);
    if (this.binanceWs) this.binanceWs.terminate();
    if (this.finnhubWs) this.finnhubWs.terminate();
    for (const res of this.subscribers) {
      try {
        res.end();
      } catch {}
    }
    this.subscribers.clear();
  }
}

export const liveStreamManager = new LiveStreamManager();
