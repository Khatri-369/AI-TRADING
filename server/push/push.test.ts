import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NewsPushService, allowedPushEndpoint } from './service';
import type { NewsResponse } from '../../shared/types';

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/unit-test', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } };
test('push endpoint allowlist rejects internal hosts, credentials, unexpected ports and lookalikes', () => {
  for (const url of ['http://fcm.googleapis.com/send', 'https://127.0.0.1', 'https://fcm.googleapis.com.evil.test', 'https://user@fcm.googleapis.com', 'https://fcm.googleapis.com:8443/send']) assert.equal(allowedPushEndpoint(url), false);
  assert.equal(allowedPushEndpoint(subscription.endpoint), true);
  assert.equal(allowedPushEndpoint('https://wns2.notify.windows.com/w'), true);
});
test('unconfigured push fails closed and never claims delivery is enabled', async () => {
  const service = new NewsPushService({});
  assert.equal((await service.status()).configured, false);
  await assert.rejects(service.subscribe(subscription));
});
test('news push persists consent, avoids old headlines and duplicate delivery, and removes subscriptions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'markets-push-'));
  try {
    let now = Date.parse('2026-10-13T08:00:00Z');
    const payloads: string[] = [];
    const options = { path: join(dir, 'subscriptions.json'), publicKey: 'A'.repeat(87), privateKey: 'B'.repeat(43), subject: 'mailto:test@example.com', now: () => now, send: async (_subscription: unknown, body: string) => { payloads.push(body); } };
    const service = new NewsPushService(options);
    await service.subscribe(subscription);
    const news: NewsResponse = { articles: [{ id: '1', headline: 'A new headline', source: 'Test', url: 'https://example.com', publishedAt: new Date(now - 60000).toISOString(), relatedAssets: [], summary: '' }], provider: 'Test', status: 'live', fetchedAt: new Date(now).toISOString(), cached: false };
    await service.deliver(news);
    assert.equal(payloads.length, 0);
    now += 300000;
    news.articles[0].publishedAt = new Date(now - 1000).toISOString();
    await service.deliver(news);
    assert.equal(payloads.length, 1);
    assert.equal(JSON.parse(payloads[0]).url, '/news');
    const restored = new NewsPushService(options);
    now += 300000;
    await restored.deliver(news);
    assert.equal(payloads.length, 1);
    await assert.rejects(restored.subscribe({ ...subscription, keys: { ...subscription.keys, auth: 'C'.repeat(22) } }));
    await restored.unsubscribe(subscription);
    assert.deepEqual(JSON.parse(await readFile(options.path, 'utf8')), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('expired push endpoints are pruned and corrupt storage is not silently replaced', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'markets-push-'));
  try {
    let now = Date.now();
    const path = join(dir, 'subscriptions.json');
    const service = new NewsPushService({ path, publicKey: 'A'.repeat(87), privateKey: 'B'.repeat(43), subject: 'mailto:test@example.com', now: () => now, send: async () => { throw { statusCode: 410 }; } });
    await service.subscribe(subscription);
    now += 300000;
    await service.deliver({ articles: [{ id: 'new', headline: 'New headline', publishedAt: new Date(now - 1000).toISOString(), source: 'Test', summary: '', url: '', relatedAssets: [] }], status: 'live', provider: 'Test', fetchedAt: null, cached: false });
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), []);
    await writeFile(path, 'corrupt');
    const broken = new NewsPushService({ path, publicKey: 'A'.repeat(87), privateKey: 'B'.repeat(43), subject: 'mailto:test@example.com' });
    assert.equal((await broken.status()).configured, false);
    await assert.rejects(broken.subscribe(subscription));
    assert.equal(await readFile(path, 'utf8'), 'corrupt');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
