import WebSocket from 'ws';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import type { Quote, MarketSession } from '../../shared/types';

const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
};

const CRYPTO_SESSION: MarketSession = {
  state: 'OPEN',
  timezone: 'UTC',
  note: '24/7 continuous digital asset market',
};

export class CryptoStreamClient {
  private ws: WebSocket | null = null;
  private stopped = true;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private lastMessage = 0;

  constructor(private readonly onQuote: (quote: Quote) => void) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  private connect() {
    if (this.stopped) return;

    try {
      const streams = Object.keys(SYMBOL_MAP)
        .map((s) => `${s.toLowerCase()}@ticker`)
        .join('/');
      const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

      const socket = new WebSocket(url, { handshakeTimeout: 10_000 });
      this.ws = socket;

      socket.on('open', () => {
        if (this.stopped) {
          socket.terminate();
          return;
        }
        this.lastMessage = Date.now();
        // Keepalive watchdog
        this.pingTimer = setInterval(() => {
          if (Date.now() - this.lastMessage > 30_000) {
            socket.terminate();
          } else {
            socket.ping();
          }
        }, 15_000);
        this.pingTimer.unref();
      });

      socket.on('pong', () => {
        this.lastMessage = Date.now();
      });

      socket.on('message', (raw) => {
        if (this.stopped) return;
        this.lastMessage = Date.now();
        try {
          const payload = JSON.parse(raw.toString());
          const data = payload.data;
          if (!data || !data.s) return;

          const symbol = SYMBOL_MAP[data.s];
          if (!symbol) return;

          const asset = ASSET_BY_SYMBOL.get(symbol);
          if (!asset) return;

          const price = parseFloat(data.c);
          const change = parseFloat(data.p);
          const changePercent = parseFloat(data.P);
          const volume = parseFloat(data.v);
          const timestamp = new Date(data.E || Date.now()).toISOString();

          if (!Number.isFinite(price) || price <= 0) return;

          const quote: Quote = {
            ...asset,
            price,
            change: Number.isFinite(change) ? change : null,
            changePercent: Number.isFinite(changePercent) ? changePercent : null,
            volume: Number.isFinite(volume) ? volume : null,
            asOf: timestamp,
            fetchedAt: new Date().toISOString(),
            provider: 'binance',
            cached: false,
            status: 'live',
            session: CRYPTO_SESSION,
          };

          this.onQuote(quote);
        } catch {
          // Ignore malformed tick frames
        }
      });

      socket.on('error', () => {
        // Handled via close
      });

      socket.on('close', () => {
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = undefined;
        }
        if (!this.stopped) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
          this.reconnectTimer.unref();
        }
      });
    } catch {
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        this.reconnectTimer.unref();
      }
    }
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
  }
}
