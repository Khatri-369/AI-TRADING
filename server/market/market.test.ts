import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataCache } from './cache';
import { MarketService, quoteFreshness } from './index';
import { MarketProviders } from './providers';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { marketSession } from './sessions';
import { FeedResponse, decodeTicks, UpstoxWebSocketClient } from './websocket';

test('missing Analytics token reports UNCONFIGURED and no fabricated Indian prices', async () => {
  let calls = 0;
  const service = new MarketService({}, async () => { calls++; throw new Error('No network permitted'); });
  const overview = await service.overview('india');
  assert.equal(calls, 0);
  assert.ok(overview.quotes.every(quote => quote.price === null && quote.status === 'unavailable'));
  assert.ok(service.providerStatuses().filter(provider => provider.id.startsWith('upstox')).every(provider => provider.status === 'UNCONFIGURED'));
});
test('regular OAuth env variable cannot enable Analytics data', async () => {
  const env = { UPSTOX_ACCESS_TOKEN: 'not-an-analytics-token' };
  const service = new MarketService(env as Record<string, string>);
  assert.equal(service.providerStatuses().find(p => p.id === 'upstox')?.configured, false);
});
test('cache shares concurrent loads and retains original timestamp on provider failure', async () => {
  let now = 100000; let calls = 0;
  const cache = new DataCache<number>(() => now);
  const loader = async () => { calls++; return 42; };
  const [first, second] = await Promise.all([cache.get('a', 100, 500, loader), cache.get('a', 100, 500, loader)]);
  assert.equal(calls, 1); assert.equal(first.value, second.value);
  now += 101;
  const stale = await cache.get('a',100,500, async () => { throw new Error('Provider unavailable'); });
  assert.equal(stale.stale,true); assert.equal(stale.fetchedAt,first.fetchedAt);
  now += 100000;
  await assert.rejects(cache.get('a',100,500,async () => {throw new Error('Provider unavailable');}));
});
test('US clock handles DST, holiday and early close; crypto trades weekends', () => {
  assert.equal(marketSession('us',new Date('2026-07-03T15:00:00Z')).state,'CLOSED');
  assert.equal(marketSession('us',new Date('2026-11-27T18:30:00Z')).state,'AFTER-HOURS');
  assert.equal(marketSession('us',new Date('2026-10-12T13:31:00Z')).state,'OPEN');
  assert.equal(marketSession('crypto',new Date('2026-10-11T13:31:00Z')).state,'OPEN');
});
test('closed sessions and old source prices are never called live', () => {
  const asset=ASSET_BY_SYMBOL.get('NIFTY50')!;
  const now=Date.parse('2026-10-12T12:00:00Z');
  assert.equal(quoteFreshness(asset,'2026-10-12T10:00:00Z',{state:'CLOSED',timezone:'Asia/Kolkata'},now),'delayed');
  assert.equal(quoteFreshness(asset,'2026-10-12T10:00:00Z',{state:'OPEN',timezone:'Asia/Kolkata'},now),'stale');
});
test('official Protobuf decodes only real LTPC with valid source time', () => {
  const timestamp = Date.now()-1000;
  const frame=FeedResponse.encode(FeedResponse.fromObject({feeds:{'NSE_INDEX|Nifty 50':{ltpc:{ltp:100,cp:80,ltt:String(timestamp)}}}})).finish();
  const ticks=decodeTicks(frame);
  assert.equal(ticks[0]?.changePercent,25); assert.equal(ticks[0]?.timestamp,new Date(timestamp).toISOString());
  const bad=FeedResponse.encode(FeedResponse.fromObject({feeds:{bad:{ltpc:{ltp:100,ltt:'0'}}}})).finish();
  assert.equal(decodeTicks(bad).length,0);
});
test('unconfigured WebSocket is inert and does not authenticate', async () => {
  const socket=new UpstoxWebSocketClient(undefined);
  await socket.start(['NSE_INDEX|Nifty 50']);
  assert.equal(socket.getStatus().status,'UNCONFIGURED');socket.stop();
});
test('provider failures sanitize raw URLs or credentials', async () => {
  const provider=new MarketProviders({FINNHUB_API_KEY:'secret-test-only'},async () => { throw new Error('https://provider.test/?token=secret-test-only'); });
  await assert.rejects(provider.usQuote('AAPL'),error => error instanceof Error && !error.message.includes('secret-test-only'));
});
