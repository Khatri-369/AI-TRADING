import test from 'node:test';
import assert from 'node:assert/strict';
import { OneSignalNewsPush, authorizedNewsJob } from './onesignal';
import type { NewsResponse } from '../../shared/types';

const now = Date.parse('2026-10-19T10:00:00Z');
const options = { appId: 'c93d06ef-e58a-43a0-8f00-87a7b632f11a', apiKey: 'private-test-only', siteUrl: 'https://example.com', now: () => now };
const article = (id: string, age = 1000) => ({ id, headline: `Headline ${id}`, publishedAt: new Date(now - age).toISOString(), source: 'Fixture', summary: '', url: 'https://example.com', relatedAssets: [] });
const feed = (articles = [article('fresh')]): NewsResponse => ({ articles, status: 'live', provider: 'Fixture', cached: false, fetchedAt: new Date(now).toISOString() });

test('scheduled news jobs require a strong exact bearer secret', () => {
  assert.equal(authorizedNewsJob(undefined, 'x'.repeat(32)), false);
  assert.equal(authorizedNewsJob('Bearer short', 'short'), false);
  assert.equal(authorizedNewsJob('Bearer ' + 'y'.repeat(32), 'x'.repeat(32)), false);
  assert.equal(authorizedNewsJob('Bearer ' + 'x'.repeat(32), 'x'.repeat(32)), true);
});
test('OneSignal selects recent news, protects credentials, and reuses idempotency across cold starts', async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.onesignal.com/notifications');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Key private-test-only');
    assert.ok(init?.signal);
    assert.doesNotMatch(String(init?.body), /private-test-only/);
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: 'accepted-id' }), { status: 200 });
  };
  const data = feed([article('old', 3600000), article('future', -1000), article('fresh'), article('fresh')]);
  await new OneSignalNewsPush({ ...options, fetcher }).deliver(data);
  await new OneSignalNewsPush({ ...options, fetcher }).deliver(data);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].idempotency_key, bodies[1].idempotency_key);
  assert.match(String(bodies[0].idempotency_key), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(bodies[0].filters, [{ field: 'tag', key: 'market_news', relation: '=', value: 'on' }]);
  assert.equal(bodies[0].url, 'https://example.com/news');
});
test('OneSignal rejects missing setup, stale feeds, and provider failures without claiming delivery', async () => {
  assert.equal(new OneSignalNewsPush({}).configured, false);
  assert.equal(new OneSignalNewsPush({ ...options, siteUrl: 'http://example.com' }).configured, false);
  const service = new OneSignalNewsPush({ ...options, fetcher: async () => new Response('private provider error', { status: 429 }) });
  assert.deepEqual(await service.deliver({ ...feed(), status: 'stale' }), { accepted: 0, skipped: 'feed-unavailable' });
  await assert.rejects(service.deliver(feed()), /Push provider rejected the news job \(429\)/);
  const empty = new OneSignalNewsPush({ ...options, fetcher: async () => new Response(JSON.stringify({ id: '' })) });
  assert.deepEqual(await empty.deliver(feed()), { accepted: 0, checked: 1, noRecipients: 1 });
});

test('news jobs explain when there are no recent headlines without calling the provider', async () => {
  const service = new OneSignalNewsPush({ ...options, fetcher: async () => { throw new Error('Must not send'); } });
  assert.deepEqual(await service.deliver(feed([article('old', 3600000)])), { accepted: 0, checked: 0, noRecipients: 0, skipped: 'no-recent-news' });
});
