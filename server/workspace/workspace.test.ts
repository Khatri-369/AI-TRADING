import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WorkspaceStore,
  WorkspaceError,
  usableQuote,
  inQuietHours,
  digest,
} from './store';
import {
  planMetrics,
  journalPnl,
  movingAverage,
  recordSchemas,
  type PriceAlert,
  type Candle,
} from '../../shared/research';
import type { Quote } from '../../shared/types';

test('WorkspaceStore manages user auth, optimistic concurrency, and watchlist sync', async () => {
  const store = new WorkspaceStore(':memory:');

  // 1. Registration
  const user = await store.register('trader_om', 'SuperSecretPass123!');
  assert.equal(user.username, 'trader_om');
  assert.ok(user.id > 0);

  // Duplicate registration should throw 409
  await assert.rejects(
    async () => store.register('trader_om', 'AnotherPass123!'),
    (err: unknown) => err instanceof WorkspaceError && err.status === 409
  );

  // 2. Authentication
  const loggedIn = await store.login('trader_om', 'SuperSecretPass123!');
  assert.equal(loggedIn.id, user.id);

  // Invalid password should throw 401
  await assert.rejects(
    async () => store.login('trader_om', 'WrongPassword123!'),
    (err: unknown) => err instanceof WorkspaceError && err.status === 401
  );

  // 3. Sessions
  const token = store.session(user.id);
  assert.ok(token.length >= 32);
  const identified = store.user(token);
  assert.equal(identified?.username, 'trader_om');

  // Unknown token returns undefined
  assert.equal(store.user('invalid_token_xyz'), undefined);

  // 4. Save Watchlist Record
  const watchlistData = { symbols: ['RELIANCE', 'TCS', 'NIFTY50'] };
  assert.ok(recordSchemas.watchlist.safeParse(watchlistData).success);

  const record1 = store.save(user.id, 'user-watchlist', 'watchlist', 0, watchlistData);
  assert.equal(record1.version, 1);
  assert.deepEqual(record1.data, watchlistData);

  // 5. Optimistic Concurrency Control (Version Mismatch)
  // Trying to save with stale version 0 should fail with 409
  assert.throws(
    () => store.save(user.id, 'user-watchlist', 'watchlist', 0, { symbols: ['INFY'] }),
    (err: unknown) => err instanceof WorkspaceError && err.status === 409
  );

  // Saving with correct version 1 succeeds and advances version to 2
  const record2 = store.save(user.id, 'user-watchlist', 'watchlist', 1, { symbols: ['RELIANCE', 'INFY'] });
  assert.equal(record2.version, 2);

  // 6. Retrieval
  const userRecords = store.records(user.id);
  assert.equal(userRecords.length, 1);
  assert.equal(userRecords[0].id, 'user-watchlist');

  // Delete
  store.remove(user.id, 'user-watchlist', 2);
  assert.equal(store.records(user.id).length, 0);

  // Destroy session
  store.logout(token);
  assert.equal(store.user(token), undefined);
});

test('Financial math calculations: plan metrics, journal PnL, and moving averages', () => {
  // 1. Long Plan Metrics
  const longPlan = {
    symbol: 'RELIANCE',
    direction: 'long' as const,
    entry: 2900,
    stop: 2850,
    target: 3050,
    quantity: 10,
    costs: 50,
    thesis: 'Breakout above 2900 resistance',
    invalidation: 'Falls below 2850',
    status: 'draft' as const,
  };
  const longMetrics = planMetrics(longPlan);
  assert.equal(longMetrics.distance, 50); // 2900 - 2850
  assert.equal(longMetrics.loss, 550); // 50 * 10 + 50 costs
  assert.equal(longMetrics.reward, 1450); // 150 * 10 - 50 costs
  assert.ok(Math.abs(longMetrics.ratio - (1450 / 550)) < 0.001);

  // 2. Short Plan Metrics
  const shortPlan = {
    symbol: 'BANKNIFTY',
    direction: 'short' as const,
    entry: 51000,
    stop: 51500,
    target: 49500,
    quantity: 2,
    costs: 100,
    thesis: 'Rejection at 51000 psychological level',
    invalidation: 'Break above 51500',
    status: 'draft' as const,
  };
  const shortMetrics = planMetrics(shortPlan);
  assert.equal(shortMetrics.distance, 500);
  assert.equal(shortMetrics.loss, 1100); // 500 * 2 + 100 costs
  assert.equal(shortMetrics.reward, 2900); // 1500 * 2 - 100 costs

  // 3. Journal PnL
  const winningTrade = {
    symbol: 'TCS',
    direction: 'long' as const,
    entry: 3500,
    exit: 3620,
    quantity: 5,
    costs: 40,
    openedAt: '2026-10-01T09:15:00Z',
    closedAt: '2026-10-05T15:30:00Z',
    notes: 'Good execution',
    followedPlan: true,
    tags: 'swing',
  };
  assert.equal(journalPnl(winningTrade), (3620 - 3500) * 5 - 40); // 600 - 40 = 560

  const losingShortTrade = {
    symbol: 'TCS',
    direction: 'short' as const,
    entry: 3500,
    exit: 3550,
    quantity: 5,
    costs: 30,
    openedAt: '2026-10-01T09:15:00Z',
    closedAt: '2026-10-02T15:30:00Z',
    notes: 'Stopped out',
    followedPlan: true,
    tags: 'daytrade',
  };
  assert.equal(journalPnl(losingShortTrade), (3500 - 3550) * 5 - 30); // -250 - 30 = -280

  // 4. Moving Average (SMA & EMA)
  const candles: Candle[] = [
    { time: '2026-10-01T00:00:00Z', open: 100, high: 110, low: 95, close: 105, volume: 1000 },
    { time: '2026-10-02T00:00:00Z', open: 105, high: 115, low: 100, close: 110, volume: 1200 },
    { time: '2026-10-03T00:00:00Z', open: 110, high: 120, low: 108, close: 115, volume: 1500 },
    { time: '2026-10-04T00:00:00Z', open: 115, high: 125, low: 112, close: 120, volume: 1100 },
  ];
  const sma3 = movingAverage(candles, 3, false);
  assert.equal(sma3.length, 2); // 4 candles - 3 + 1 = 2
  assert.equal(sma3[0].value, (105 + 110 + 115) / 3); // 110
  assert.equal(sma3[1].value, (110 + 115 + 120) / 3); // 115
});

test('Market quotes usability and quiet-hours filtering logic', () => {
  const now = Date.parse('2026-10-13T10:00:00Z');

  // Valid live open quote
  const validQuote: Quote = {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    category: 'india',
    price: 2950.5,
    currency: 'INR',
    change: 25.5,
    changePercent: 0.87,
    volume: 3500000,
    status: 'live',
    session: { state: 'OPEN', timezone: 'Asia/Kolkata', note: 'Regular trading' },
    asOf: new Date(now - 10000).toISOString(), // 10s old
    fetchedAt: new Date(now).toISOString(),
    provider: 'upstox',
    cached: false,
  };
  assert.equal(usableQuote(validQuote, now), true);

  // Stale or closed quote should not be usable for instant trigger
  const closedQuote: Quote = {
    ...validQuote,
    session: { state: 'CLOSED', timezone: 'Asia/Kolkata', note: 'Market closed' },
  };
  assert.equal(usableQuote(closedQuote, now), false);

  const staleQuote: Quote = {
    ...validQuote,
    asOf: new Date(now - 300000).toISOString(), // 5 minutes old
  };
  assert.equal(usableQuote(staleQuote, now), false);

  // Quiet Hours Check
  const alert: PriceAlert = {
    symbol: 'RELIANCE',
    direction: 'above',
    level: 3000,
    paused: false,
    expiresAt: '2026-10-20T00:00:00Z',
    timezone: 'Asia/Kolkata',
    quietStart: 22, // 10 PM
    quietEnd: 8,    // 8 AM
  };

  // 11 PM IST is quiet hours
  const nightTimeIST = Date.parse('2026-10-13T17:30:00Z'); // 23:00 IST
  assert.equal(inQuietHours(alert, nightTimeIST), true);

  // 2 PM IST is active hours
  const afternoonTimeIST = Date.parse('2026-10-13T08:30:00Z'); // 14:00 IST
  assert.equal(inQuietHours(alert, afternoonTimeIST), false);

  // Digest verification
  assert.equal(typeof digest('test-value'), 'string');
  assert.equal(digest('test-value').length, 64);
});
