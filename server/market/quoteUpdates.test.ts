import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptQuoteUpdate, mergeQuoteUpdate } from '../../shared/quoteUpdates';
import type { Quote } from '../../shared/types';

const now = Date.parse('2026-10-16T05:00:00Z');
const at = (seconds: number) => new Date(now + seconds * 1000).toISOString();
const base: Quote = { symbol: 'RELIANCE', name: 'Reliance', category: 'india', currency: 'INR', price: 100, change: 1, changePercent: 1, volume: 1000, asOf: at(-10), fetchedAt: at(-1), provider: 'upstox', cached: false, status: 'live', session: { state: 'OPEN', timezone: 'Asia/Kolkata' } };

test('stream storage never regresses observation time or accepts duplicate frames', () => {
  assert.equal(acceptQuoteUpdate({ ...base, asOf: at(-20), fetchedAt: at(0) }, base, now), false);
  assert.equal(acceptQuoteUpdate(base, base, now), false);
  assert.equal(acceptQuoteUpdate({ ...base, asOf: at(-5) }, base, now), true);
  assert.equal(acceptQuoteUpdate({ ...base, fetchedAt: at(0) }, base, now), true);
});

test('unknown symbols, future observations, invalid timestamps and empty prices cannot poison the stream', () => {
  for (const patch of [{ symbol: 'UNKNOWN' }, { currency: 'USD' }, { asOf: 'invalid' }, { fetchedAt: null }, { asOf: at(120) }, { fetchedAt: at(120) }, { price: null }, { price: NaN }, { price: -1 }, { status: 'unavailable' as const }]) {
    assert.equal(acceptQuoteUpdate({ ...base, ...patch }, undefined, now), false);
  }
});

test('a newer observation wins even when its receipt predates the HTTP response', () => {
  const tick = { ...base, price: 102, asOf: at(-2), fetchedAt: at(-2), volume: null };
  const merged = mergeQuoteUpdate(base, tick, now);
  assert.equal(merged.price, 102);
  assert.equal(merged.volume, 1000);
  assert.equal(base.price, 100);
  assert.equal(mergeQuoteUpdate({ ...base, asOf: at(0) }, tick, now).price, 100);
});

test('stream expiry and timestamps allow REST recovery without mixing provider volume units', () => {
  const rest = { ...base, symbol: 'BTC', category: 'crypto' as const, currency: 'USD', provider: 'coingecko', volume: 5000000 };
  const tick = { ...rest, provider: 'binance', price: 105, asOf: at(-2), fetchedAt: at(-2), volume: 22 };
  assert.equal(mergeQuoteUpdate(rest, tick, now).volume, 22);
  assert.equal(mergeQuoteUpdate(rest, { ...tick, volume: null }, now).volume, null);
  assert.equal(mergeQuoteUpdate(rest, tick, now + 61000), rest);
  assert.equal(mergeQuoteUpdate(rest, { ...tick, symbol: 'ETH' }, now), rest);
  assert.equal(mergeQuoteUpdate({ ...rest, session: { state: 'UNKNOWN', timezone: 'UTC' } }, tick, now).session.state, 'OPEN');
});
