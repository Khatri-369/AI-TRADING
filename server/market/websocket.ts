import protobuf from 'protobufjs';
import WebSocket from 'ws';
import { z } from 'zod';
import schema from './feedSchema';
import { validTime } from './http';

export const FeedResponse = protobuf.Root.fromJSON(schema).lookupType('com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse');
const ltpcSchema = z.object({ ltp: z.number().finite().positive(), cp: z.number().finite().nonnegative().optional(), ltt: z.union([z.string(), z.number()]) });
const frameSchema = z.object({ feeds: z.record(z.string(), z.unknown()).optional() });
export interface UpstoxFeedUpdate { instrumentKey: string; lastPrice: number; change: number | null; changePercent: number | null; timestamp: string }
export function decodeTicks(bytes: Uint8Array): UpstoxFeedUpdate[] {
  const frame = frameSchema.parse(FeedResponse.toObject(FeedResponse.decode(bytes), { longs: String, enums: String }));
  const ticks: UpstoxFeedUpdate[] = [];
  for (const [instrumentKey, feed] of Object.entries(frame.feeds ?? {})) {
    const parsed = z.object({ ltpc: ltpcSchema }).safeParse(feed);
    if (!parsed.success) continue;
    const { ltp, cp, ltt } = parsed.data.ltpc;
    try { ticks.push({ instrumentKey, lastPrice: ltp, change: cp ? ltp - cp : null, changePercent: cp ? (ltp - cp) / cp * 100 : null, timestamp: validTime(Number(ltt), true) }); }
    catch { /* Invalid source timestamps must not become current timestamps. */ }
  }
  return ticks;
}
export class UpstoxWebSocketClient {
  private ws: WebSocket | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setInterval>;
  private controller?: AbortController;
  private stopped = true;
  private attempt = 0;
  private generation = 0;
  private keys: string[] = [];
  private lastFrame = 0;
  private state = 'UNCONFIGURED';
  private message = 'Set UPSTOX_ANALYTICS_TOKEN for the read-only one-year Analytics feed.';
  constructor(private readonly token: string | undefined, private readonly onTick?: (tick: UpstoxFeedUpdate) => void) { this.stop(); }
  getStatus() { return { status: this.state, message: this.message, configured: !!this.token }; }
  async start(keys: string[]) {
    if (!this.stopped) return;
    if (!this.token) return;
    this.keys = [...new Set(keys)];
    if (!this.keys.length) { this.state = 'unavailable'; this.message = 'No supported instruments were resolved.'; return; }
    this.stopped = false;
    await this.connect();
  }
  private async connect() {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.state = 'connecting'; this.message = 'Authorizing read-only Upstox feed.';
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 10_000);
    try {
      const response = await fetch('https://api.upstox.com/v3/feed/market-data-feed/authorize', { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }, signal: this.controller.signal, redirect: 'error' });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Authorization failed'); }
      const parsed = z.object({ status: z.literal('success'), data: z.object({ authorized_redirect_uri: z.string().url() }) }).parse(await response.json());
      const url = new URL(parsed.data.authorized_redirect_uri);
      if (url.protocol !== 'wss:' || !url.hostname.endsWith('.upstox.com')) throw new Error('Invalid feed host');
      if (this.stopped || generation !== this.generation) return;
      const socket = new WebSocket(url, { handshakeTimeout: 10_000, maxPayload: 2_000_000 });
      this.ws = socket;
      socket.on('open', () => {
        if (this.stopped || generation !== this.generation) { socket.terminate(); return; }
        this.state = 'connected'; this.message = 'WebSocket connected; awaiting validated market observations.';
        this.attempt = 0; this.lastFrame = Date.now();
        socket.send(Buffer.from(JSON.stringify({ guid: `market-${Date.now()}`, method: 'sub', data: { mode: 'ltpc', instrumentKeys: this.keys } })), { binary: true });
        this.watchdog = setInterval(() => { if (Date.now() - this.lastFrame > 60_000) socket.terminate(); else socket.ping(); }, 20_000);
        this.watchdog.unref();
      });
      socket.on('pong', () => { this.lastFrame = Date.now(); });
      socket.on('message', (raw) => {
        if (this.stopped || generation !== this.generation) return;
        this.lastFrame = Date.now();
        try {
          const bytes = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          for (const tick of decodeTicks(bytes)) if (this.keys.includes(tick.instrumentKey)) {
            this.message = `Validated market observation received ${new Date().toISOString()}; source trade time ${tick.timestamp}.`;
            this.onTick?.(tick);
          }
        } catch { this.message = 'Malformed feed frame ignored; REST quotes remain available.'; }
      });
      socket.on('error', () => { this.state = 'unavailable'; this.message = 'Upstox feed connection failed; REST quotes remain available.'; });
      socket.on('close', () => { clearInterval(this.watchdog); if (!this.stopped && generation === this.generation) this.reconnect(); });
    } catch {
      if (!this.stopped && generation === this.generation) { this.state = 'unavailable'; this.message = 'Upstox feed authorization/connection unavailable. Check token permissions and network.'; this.reconnect(); }
    } finally { clearTimeout(timeout); }
  }
  private reconnect() {
    if (this.stopped || this.timer) return;
    this.state = 'reconnecting';
    this.timer = setTimeout(() => { this.timer = undefined; void this.connect(); }, Math.min(60_000, 2000 * 2 ** Math.min(this.attempt++, 5)));
    this.timer.unref();
  }
  stop() {
    this.stopped = true; this.generation++;
    clearTimeout(this.timer); this.timer = undefined; clearInterval(this.watchdog); this.controller?.abort();
    this.ws?.terminate(); this.ws = null;
    this.state = this.token ? 'idle' : 'UNCONFIGURED'; this.message = this.token ? 'Feed idle; connects when a dashboard subscribes.' : 'Set UPSTOX_ANALYTICS_TOKEN for the one-year read-only Analytics feed.';
  }
}
