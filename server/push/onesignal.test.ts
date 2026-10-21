import test from 'node:test';
import assert from 'node:assert/strict';
import { OneSignalNewsPush, authorizedNewsJob, retryDelay } from './onesignal';
import { canonicalArticleUrl, queueHeadline, RedisNewsQueue, type NewsQueue, type QueuedHeadline } from './newsQueue';
import type { NewsResponse } from '../../shared/types';

// Test-only database double shared by separate sender instances, never used by production.
class TestQueue implements NewsQueue {
  configured = true;
  records = new Map<string, QueuedHeadline>();
  due = new Map<string, number>();
  owner: string | null = null;
  cooldown = 0;
  lastPoll = -Infinity;
  failCommit = false;
  async acquire(owner: string) { if (this.owner) return false; this.owner = owner; return true; }
  async release(owner: string) { if (this.owner === owner) this.owner = null; }
  async pollDue(now: number) { return now - this.lastPoll >= 240000; }
  async enqueue(owner: string, records: QueuedHeadline[], now: number) {
    assert.equal(owner, this.owner);
    let added = 0;
    for (const record of records) if (!this.records.has(record.key)) {
      this.records.set(record.key, structuredClone(record)); this.due.set(record.key, now); added++;
    }
    this.lastPoll = now; return added;
  }
  async next(owner: string, now: number) {
    assert.equal(owner, this.owner);
    if (now < this.cooldown) return null;
    const next = [...this.due].filter(([, due]) => due <= now).sort((a,b) => a[1] - b[1])[0];
    if (!next) return null;
    const record = this.records.get(next[0])!;
    record.firstAttempt ??= now; record.attempts++;
    this.due.set(record.key, now + 120000);
    return structuredClone(record);
  }
  async save(owner: string, record: QueuedHeadline, due: number, cooldown = 0) {
    assert.equal(owner, this.owner);
    if (this.failCommit && record.state === 'accepted') throw new Error('Database unavailable');
    this.records.set(record.key, structuredClone(record));
    if (record.state === 'pending') this.due.set(record.key, due); else this.due.delete(record.key);
    if (cooldown) this.cooldown = cooldown;
  }
  async counts() { return { pending: this.due.size, review: [...this.records.values()].filter(x => x.state === 'review').length }; }
}
const start = Date.parse('2026-10-19T10:00:00Z');
const article = (id: string) => ({ id, headline: `Neutral headline ${id}`, source: 'Publisher', url: `https://example.com/article/${id}`, publishedAt: '2020-01-01T00:00:00Z', summary: '', relatedAssets: [] });
const feed = (ids = ['a']): NewsResponse => ({ articles: ids.map(article), status: 'live', provider: 'Fixture', cached: false, fetchedAt: new Date(start).toISOString() });
function setup() {
  const queue = new TestQueue(); let time = start;
  const calls: Record<string, unknown>[] = [];
  let response = () => new Response(JSON.stringify({ id: 'message-id' }));
  const options = { appId: 'c93d06ef-e58a-43a0-8f00-87a7b632f11a', apiKey: 'private-test-only', queue,
    now: () => time, sleep: async (ms: number) => { time += ms; },
    fetcher: (async (_url, init) => { assert.equal(new Headers(init?.headers).get('Authorization'), 'Key private-test-only'); calls.push(JSON.parse(String(init?.body))); return response(); }) as typeof fetch };
  return { queue, calls, options, sender: () => new OneSignalNewsPush(options), advance: (ms: number) => { time += ms; }, setResponse: (fn: typeof response) => { response = fn; } };
}
test('cron auth requires exact strong Bearer secret', () => {
  assert.equal(authorizedNewsJob(undefined, 'x'.repeat(32)), false);
  assert.equal(authorizedNewsJob('Bearer short', 'short'), false);
  assert.equal(authorizedNewsJob('Bearer ' + 'y'.repeat(32), 'x'.repeat(32)), false);
  assert.equal(authorizedNewsJob('Bearer ' + 'x'.repeat(32), 'x'.repeat(32)), true);
});
test('canonical URLs deduplicate tracking and fragments but preserve article query IDs', () => {
  assert.equal(canonicalArticleUrl('https://example.com/a?utm_source=x&id=1#top'), 'https://example.com/a?id=1');
  assert.equal(queueHeadline(article('a')).key, queueHeadline({ ...article('a'), id: 'different-provider-id', url: article('a').url + '?utm_medium=rss' }).key);
  assert.notEqual(queueHeadline(article('a')).key, queueHeadline(article('b')).key);
  assert.throws(() => canonicalArticleUrl('javascript:alert(1)'));
});
test('every observed headline including old and neutral is sent; cold starts and timestamp edits do not resend', async () => {
  const t = setup(); const data = feed(['a','b','c','d','e']);
  const result = await t.sender().deliver(data); assert.equal(result.accepted, 5);
  assert.equal(t.calls.length, 5);
  assert.deepEqual(t.calls[0].headings, { en: 'TRADEXA · Publisher' });
  assert.deepEqual(t.calls[0].contents, { en: 'Neutral headline a\nNo specific stock identified' });
  assert.equal(t.calls[0].url, article('a').url);
  assert.deepEqual(t.calls[0].filters, [{ field: 'tag', key: 'market_news', relation: '=', value: 'on' }]);
  assert.doesNotMatch(JSON.stringify(t.calls), /private-test-only/);
  t.advance(40 * 86400000);
  data.articles[0].publishedAt = new Date(start).toISOString();
  data.articles[0].url += '?utm_source=another';
  await t.sender().deliver(data); assert.equal(t.calls.length, 5);
});
test('batch overflow persists and is drained even after it disappears from provider feed', async () => {
  const t = setup(); await t.sender().deliver(feed(Array.from({length: 45}, (_, i) => String(i))));
  assert.equal(t.calls.length, 40); assert.equal((await t.queue.counts()).pending, 5);
  t.advance(300000); await t.sender().deliver(feed([]));
  assert.equal(t.calls.length, 45); assert.equal((await t.queue.counts()).pending, 0);
});
test('partial failure retains only failed article and uses identical retry key', async () => {
  const t = setup(); let attempt = 0;
  t.setResponse(() => ++attempt === 2 ? new Response('{}', { status: 400 }) : new Response('{"id":"ok"}'));
  const result = await t.sender().deliver(feed(['a','b','c']));
  assert.equal(result.accepted, 2); assert.equal(result.failed, 1);
  t.advance(300000); await t.sender().deliver(feed([]));
  assert.equal(t.calls.length, 4); assert.equal(t.calls[1].idempotency_key, t.calls[3].idempotency_key);
  assert.equal((await t.queue.counts()).pending, 0);
});
test('429 Retry-After pauses the whole queue across invocations without repolling providers', async () => {
  const t = setup(); t.setResponse(() => new Response('{}', { status: 429, headers: {'Retry-After': '900'} }));
  await t.sender().deliver(feed(['a','b']));
  let polls = 0; await t.sender().deliver(async () => { polls++; return feed(); });
  assert.equal(polls, 0); assert.equal(t.calls.length, 1);
  t.advance(300000); await t.sender().deliver(feed([])); assert.equal(t.calls.length, 1);
  t.setResponse(() => new Response('{"id":"ok"}')); t.advance(600000);
  await t.sender().deliver(feed([])); assert.equal(t.calls.length, 3);
  assert.equal(retryDelay(1, new Date(start + 900000).toUTCString(), start), 900000);
});
test('acceptance followed by failed database write safely retries with the same idempotency key', async () => {
  const t = setup(); t.queue.failCommit = true;
  await assert.rejects(t.sender().deliver(feed()), /Database unavailable/);
  assert.equal([...t.queue.records.values()][0].state, 'pending');
  t.queue.failCommit = false; t.advance(300000);
  await t.sender().deliver(feed());
  assert.equal(t.calls[0].idempotency_key, t.calls[1].idempotency_key);
});
test('network failure and empty message ID never mark delivered', async () => {
  for (const response of [() => { throw new Error('network'); }, () => new Response('{"id":""}')]) {
    const t = setup(); t.setResponse(response); await t.sender().deliver(feed());
    assert.equal([...t.queue.records.values()][0].state, 'pending');
    assert.equal((await t.queue.counts()).pending, 1);
  }
});
test('concurrent jobs cannot send or poll while another owns the lease', async () => {
  const t = setup(); await t.queue.acquire('other');
  const result = await t.sender().deliver(async () => { throw new Error('Must not fetch'); });
  assert.equal(result.skipped, 'job-already-running'); assert.equal(t.calls.length, 0);
});
test('feed outage still drains durable backlog; long uncertain requests retained for review', async () => {
  const t = setup(); t.setResponse(() => new Response('{}', {status: 500}));
  await t.sender().deliver(feed()); t.advance(300000); t.setResponse(() => new Response('{"id":"ok"}'));
  const result = await t.sender().deliver(async () => { throw new Error('feed down'); });
  assert.equal(result.accepted, 1); assert.equal(result.feedUnavailable, true);
  const u = setup(); u.setResponse(() => new Response('{}', {status: 500}));
  await u.sender().deliver(feed()); u.advance(29 * 86400000);
  const review = await u.sender().deliver(feed()); assert.equal(review.review, 1); assert.equal(u.calls.length, 1);
});
test('missing persistent store fails closed and Redis errors never leak credentials', async () => {
  assert.equal(new OneSignalNewsPush({ appId: setup().options.appId, apiKey: 'test' }).configured, false);
  const q = new RedisNewsQueue('https://example.com', 'private-redis-token', 'test', async (_url, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private-redis-token');
    return new Response('{"error":"private-redis-token"}');
  });
  await assert.rejects(q.acquire('test'), error => error instanceof Error && !error.message.includes('private-redis-token'));
});

test('explicit no-subscribers rejection can recover with a new persisted generation, while retaining the queued headline', async () => {
  const t = setup();
  t.setResponse(() => new Response('{"id":"","errors":["All included players are not subscribed"]}'));
  await t.sender().deliver(feed());
  const record = [...t.queue.records.values()][0];
  assert.equal(record.state, 'pending'); assert.equal(record.deliveryGeneration, 1);
  t.advance(300000);t.setResponse(() => new Response('{"id":"accepted"}'));
  await t.sender().deliver(feed());
  assert.notEqual(t.calls[0].idempotency_key, t.calls.at(-1)?.idempotency_key);
  assert.equal([...t.queue.records.values()][0].state, 'accepted');
});
