import { test, expect } from '@playwright/test';

test('real news polling delivers in a hidden tab, queues cooldown arrivals and respects mute', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify({ enabled: true, device: true, quiet: false, scope: 'all' }));
    const deliveries: string[] = [];
    Object.assign(window, { deliveries });
    class FakeNotification {
      static permission = 'granted';
      constructor(_title: string, options: NotificationOptions) { deliveries.push(options.body ?? ''); }
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification });
    // A supported service worker API without a registered worker must not hang delivery.
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => undefined, ready: new Promise(() => {}), addEventListener() {}, register: async () => { throw new Error('Test worker disabled'); } } });
  });
  let batch = 0; let calls = 0;
  const stamp = new Date().toISOString();
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes: [], generatedAt: stamp } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.route('**/api/news', route => {
    calls++;
    return route.fulfill({ json: { articles: Array.from({ length: batch + 1 }, (_, i) => ({ id: `news-${i}`, headline: `Fresh headline ${i}`, source: 'Fixture', publishedAt: stamp, summary: 'News fixture', url: `https://example.com/${i}`, relatedAssets: [] })).reverse(), provider: 'Fixture', status: 'live', cached: false, fetchedAt: stamp } });
  });
  const delivered = () => page.evaluate(() => (window as unknown as { deliveries: string[] }).deliveries);
  await page.goto('/');
  await expect.poll(() => calls).toBe(1);
  await page.clock.runFor(100);
  expect(await delivered()).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => calls).toBe(2);
  batch = 1;
  await page.clock.runFor(60_100);
  await expect.poll(() => calls).toBe(3);
  await page.clock.runFor(100);
  await expect.poll(delivered).toEqual(['Fresh headline 1\nNo specific stock identified']);
  batch = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => calls).toBe(4);
  await page.clock.runFor(100);
  expect(await delivered()).toHaveLength(1);
  await page.clock.runFor(30_100);
  await expect.poll(delivered).toEqual(['Fresh headline 1\nNo specific stock identified', 'Fresh headline 2\nNo specific stock identified']);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => calls).toBe(5);
  await page.clock.runFor(100);
  expect(await delivered()).toHaveLength(2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify({ enabled: false, device: true, quiet: false, scope: 'all' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'markets.alerts.settings.v1' }));
  });
  await expect.poll(() => calls).toBe(6);
  batch = 3;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => calls).toBe(7);
  await page.clock.runFor(100);
  await page.evaluate(() => {
    const settings = { enabled: true, device: true, quiet: false, scope: 'all' };
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('market-alert-settings-changed', { detail: settings }));
  });
  await page.clock.runFor(30_100);
  expect(await delivered()).toHaveLength(2);
});
