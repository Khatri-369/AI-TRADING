import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceStore, inQuietHours } from './store';
import { alertSchema, journalSchema, journalStatistics } from '../../shared/research';
import type { Quote } from '../../shared/types';

const quote = (price: number, time: number): Quote => ({ symbol: 'RELIANCE', name: 'Reliance', category: 'india', currency: 'INR', price, change: null, changePercent: null, volume: null, asOf: new Date(time).toISOString(), fetchedAt: new Date(time).toISOString(), provider: 'test-only', status: 'live', cached: false, session: { state: 'OPEN', timezone: 'Asia/Kolkata' } });
const rule = alertSchema.parse({ symbol: 'RELIANCE', direction: 'above', level: 100, expiresAt: '2099-01-01T00:00:00Z', timezone: 'Asia/Kolkata', quietStart: 0, quietEnd: 0 });

test('crossing alerts establish baselines, deduplicate, honor cooldown, quiet hours, pause and expiry', async () => {
  const store = new WorkspaceStore(':memory:');
  try {
    const user = await store.register('alerts', 'test-password-only');
    let now = Date.parse('2026-10-13T07:00:00Z');
    store.save(user.id, 'cross', 'alert', 0, rule);
    assert.equal(store.evaluate([quote(99, now)], now).length, 0);
    now += 60000;
    assert.equal(store.evaluate([quote(101, now)], now).length, 1);
    assert.equal(store.evaluate([quote(101, now)], now).length, 0);
    assert.equal(store.evaluate([quote(99, now - 1000)], now).length, 0);
    now += 60000; store.evaluate([quote(99, now)], now);
    now += 60000; assert.equal(store.evaluate([quote(102, now)], now).length, 0);
    assert.equal(store.events(user.id)[0].status, 'cooldown');
    // A long gap resets the baseline; no cross-session fabricated crossing.
    now += 20 * 60000; assert.equal(store.evaluate([quote(99, now)], now).length, 0);
    now += 60000; assert.equal(store.evaluate([quote(101, now)], now).length, 1);
    store.save(user.id, 'cross', 'alert', 1, { ...rule, quietStart: 12, quietEnd: 14 });
    now += 60000; store.evaluate([quote(99, now)], now);
    now += 60000; assert.equal(store.evaluate([quote(102, now)], now).length, 0);
    assert.equal(store.events(user.id)[0].status, 'quiet-hours');
    const count = store.events(user.id).length;
    store.save(user.id, 'cross', 'alert', 2, { ...rule, paused: true });
    now += 60000; store.evaluate([quote(99, now)], now);
    now += 60000; store.evaluate([quote(102, now)], now);
    assert.equal(store.events(user.id).length, count);
    store.save(user.id, 'cross', 'alert', 3, { ...rule, expiresAt: new Date(now - 1).toISOString() });
    assert.equal(store.evaluate([quote(102, now)], now).length, 0);
  } finally { store.close(); }
});

test('alerts ignore stale data and respect DST quiet hours', async () => {
  const store = new WorkspaceStore(':memory:');
  try {
    const user = await store.register('freshness', 'test-password-only');
    store.save(user.id, 'a', 'alert', 0, rule);
    const now = Date.now();
    store.evaluate([quote(99, now)], now);
    assert.equal(store.evaluate([{ ...quote(101, now + 60000), status: 'stale' }], now + 60000).length, 0);
    assert.equal(store.events(user.id).length, 0);
    const quiet = { timezone: 'America/New_York', quietStart: 1, quietEnd: 2 };
    for (const time of ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z']) assert.equal(inQuietHours(quiet, Date.parse(time)), true);
  } finally { store.close(); }
});

test('practice ledger isolates users, charges both sides, reserves cash and rejects invalid fills', async () => {
  const store = new WorkspaceStore(':memory:');
  try {
    const a = await store.register('one', 'test-password-only');
    const b = await store.register('two', 'test-password-only');
    const q = quote(100, Date.now());
    const position = store.openPaper(a.id, 'position', q, 10, 10, 5);
    assert.equal(position.entry, 100.05);
    assert.ok(Math.abs(position.fees - 1.0005) < 1e-8);
    assert.deepEqual(store.openPaper(a.id, 'position', q, 10, 10, 5), position);
    assert.throws(() => store.openPaper(a.id, 'position', q, 11, 10, 5), /different inputs/);
    assert.throws(() => store.openPaper(a.id, 'expensive', q, 1000, 10, 5), /Insufficient/);
    assert.throws(() => store.openPaper(a.id, 'stale', { ...q, status: 'stale' }, 1, 0, 0), /fresh/);
    assert.throws(() => store.openPaper(a.id, 'index', { ...q, symbol: 'NIFTY50' }, 1, 0, 0), /equity/);
    assert.throws(() => store.openPaper(a.id, 'negative', q, -1, 0, 0), /Invalid/);
    assert.deepEqual(store.paper(b.id), []);
    assert.throws(() => store.closePaper(b.id, 'position', q), /not found/);
    const closed = store.closePaper(a.id, 'position', quote(110, Date.now()));
    assert.equal(closed.exit, 110 * .9995);
    assert.ok(Math.abs(closed.fees - (100.05 + 110 * .9995) * 10 * .001) < 1e-8);
    assert.deepEqual(store.closePaper(a.id, 'position', { ...q, status: 'stale' }), closed);
    assert.equal(store.paper(a.id).length, 1);
  } finally { store.close(); }
});

test('account password rotation invalidates sessions and deletion removes only owned records', async () => {
  const store = new WorkspaceStore(':memory:');
  try {
    const a = await store.register('alice', 'test-password-only');
    const b = await store.register('bob', 'test-password-only');
    for (const u of [a, b]) store.save(u.id, 'same-id', 'watchlist', 0, { symbols: ['TCS'] });
    const session = store.session(a.id);
    await store.changePassword(a, 'test-password-only', 'a-different-test-password');
    assert.equal(store.user(session), undefined);
    await assert.rejects(store.login('alice', 'test-password-only'));
    assert.equal((await store.login('alice', 'a-different-test-password')).id, a.id);
    store.deleteUser(a.id);
    assert.deepEqual(store.records(a.id), []);
    assert.equal(store.records(b.id).length, 1);
  } finally { store.close(); }
});

test('journal statistics handle long, short, break-even, fees and empty samples', () => {
  assert.equal(journalStatistics([]).winRate, null);
  const base = { symbol: 'TCS', direction: 'long', entry: 100, exit: 110, quantity: 1, costs: 1, openedAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-02T00:00:00Z', notes: '', followedPlan: true, tags: '' };
  const entries = [journalSchema.parse(base), journalSchema.parse({ ...base, direction: 'short', exit: 120, closedAt: '2026-01-03T00:00:00Z', followedPlan: false }), journalSchema.parse({ ...base, exit: 101, closedAt: '2026-01-04T00:00:00Z' })];
  const stats = journalStatistics(entries);
  assert.equal(stats.net, -12);
  assert.equal(stats.drawdown, 21);
  assert.equal(stats.averageWin, 9);
  assert.equal(stats.averageLoss, -21);
  assert.ok(Math.abs(stats.winRate! - 100 / 3) < 1e-10);
  assert.equal(journalSchema.safeParse({ ...base, closedAt: '2025-01-01T00:00:00Z' }).success, false);
});
