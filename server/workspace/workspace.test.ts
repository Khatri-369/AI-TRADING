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
  planSchema,
  planMetrics,
  estimatePlanCosts,
  calculateQuantityFromBudget,
  convertCurrency,
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

test('Trade-planning calculations: ordering validation, costs, budget sizing, and currency integrity', () => {
  // 1. Long scenario level validation
  const validLong = {
    symbol: 'INFY',
    exchange: 'NSE',
    currency: 'INR',
    createdAt: '2026-10-13T10:00:00Z',
    direction: 'long' as const,
    entry: 1850,
    stop: 1800,
    target: 1950,
    quantity: 20,
    costs: 0,
    feeBps: 10,
    slippageBps: 5,
    thesis: 'Cup and handle breakout above 1850',
    evidence: 'Rising volume, RSI divergence',
    invalidation: 'Daily close below 1800 invalidates setup',
    newsLinks: [{ title: 'Q2 earnings results', url: 'https://example.com/infy-q2' }],
    chartSnapshot: 'chart-INFY-default',
    status: 'watching' as const,
  };
  assert.ok(planSchema.safeParse(validLong).success);

  // Inverted long levels (stop above entry) must fail validation
  const invertedLong = { ...validLong, stop: 1880 };
  assert.equal(planSchema.safeParse(invertedLong).success, false);

  // Target below entry on long must fail validation
  const invalidTargetLong = { ...validLong, target: 1820 };
  assert.equal(planSchema.safeParse(invalidTargetLong).success, false);

  // Zero distance (entry === stop) must fail validation
  const zeroDistanceLong = { ...validLong, stop: 1850 };
  assert.equal(planSchema.safeParse(zeroDistanceLong).success, false);

  // 2. Short scenario level validation
  const validShort = {
    ...validLong,
    direction: 'short' as const,
    entry: 1850,
    stop: 1890,
    target: 1750,
  };
  assert.ok(planSchema.safeParse(validShort).success);

  // Inverted short levels (stop below entry) must fail validation
  const invertedShort = { ...validShort, stop: 1820 };
  assert.equal(planSchema.safeParse(invertedShort).success, false);

  // Target above entry on short must fail validation
  const invalidTargetShort = { ...validShort, target: 1900 };
  assert.equal(planSchema.safeParse(invalidTargetShort).success, false);

  // 3. Costs, fee & slippage calculation
  // Entry = 1000, Qty = 10. Round-trip BPS = (10 + 5) * 2 = 30 bps = 0.003
  // 1000 * 10 * 0.003 = 30
  const estimatedCosts = estimatePlanCosts(1000, 10, 10, 5);
  assert.equal(estimatedCosts, 30);

  // Plan metrics with automated costs calculation when costs = 0
  const metricsWithAutoCosts = planMetrics(validLong);
  assert.equal(metricsWithAutoCosts.distance, 50); // 1850 - 1800
  assert.equal(metricsWithAutoCosts.targetDistance, 100); // 1950 - 1850
  // Costs = 1850 * 20 * 0.003 = 111
  assert.equal(metricsWithAutoCosts.effectiveCosts, 111);
  assert.equal(metricsWithAutoCosts.loss, 50 * 20 + 111); // 1111
  assert.equal(metricsWithAutoCosts.reward, 100 * 20 - 111); // 1889
  assert.ok(Math.abs(metricsWithAutoCosts.ratio - (1889 / 1111)) < 0.001);

  // 4. Budget-derived quantity calculation (Equity lot size = 1)
  // Distance = 50, Entry = 1850, Friction per unit = 1850 * 0.003 = 5.55. Risk per unit = 55.55.
  // Budget = 2000 -> 2000 / 55.55 = 36.003 -> 36 units
  const budgetResult = calculateQuantityFromBudget({
    symbol: 'INFY',
    entry: 1850,
    stop: 1800,
    budget: 2000,
    feeBps: 10,
    slippageBps: 5,
  });
  assert.equal(budgetResult.supported, true);
  assert.equal(budgetResult.quantity, 36);
  assert.equal(budgetResult.lotSize, 1);
  assert.ok(budgetResult.totalRisk <= 2000);

  // Insufficient budget (budget < risk per unit)
  const smallBudgetResult = calculateQuantityFromBudget({
    symbol: 'INFY',
    entry: 1850,
    stop: 1800,
    budget: 30, // less than 55.55
  });
  assert.equal(smallBudgetResult.quantity, 0);
  assert.ok(smallBudgetResult.limitation?.includes('insufficient'));

  // Broad index constraint (NIFTY50, BANKNIFTY, SENSEX)
  const indexResult = calculateQuantityFromBudget({
    symbol: 'NIFTY50',
    entry: 25000,
    stop: 24900,
    budget: 5000,
  });
  assert.equal(indexResult.supported, false);
  assert.ok(indexResult.limitation?.includes('Broad market index'));

  // Invalid inputs throw errors
  assert.throws(
    () => calculateQuantityFromBudget({ symbol: 'INFY', entry: 1850, stop: 1850, budget: 1000 }),
    /zero distance/
  );
  assert.throws(
    () => calculateQuantityFromBudget({ symbol: 'INFY', entry: -100, stop: 1800, budget: 1000 }),
    /positive valid numbers/
  );
  assert.throws(
    () => calculateQuantityFromBudget({ symbol: 'INFY', entry: 1850, stop: 1800, budget: -50 }),
    /positive number/
  );

  // 5. Currency conversion integrity
  // Same currency identity
  const inrToInr = convertCurrency(100, 'INR', 'INR');
  assert.equal(inrToInr.amount, 100);

  // Explicit conversion rate with timestamp
  const usdToInr = convertCurrency(100, 'USD', 'INR', 83.5, '2026-10-13T10:00:00Z');
  assert.equal(usdToInr.amount, 8350);
  assert.equal(usdToInr.rate, 83.5);
  assert.equal(usdToInr.timestamp, '2026-10-13T10:00:00Z');

  // Combining currencies without rate or timestamp throws an error
  assert.throws(() => convertCurrency(100, 'USD', 'INR'), /without an explicit/);
  assert.throws(() => convertCurrency(100, 'USD', 'INR', 83.5), /without an explicit/);
});

