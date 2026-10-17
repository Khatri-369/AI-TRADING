import { test, expect } from '@playwright/test';

test('reconnection refreshes visible market and news data without changing the overview landing page', async ({ page }) => {
  let marketCalls = 0; let newsCalls = 0;
  const stamp = new Date().toISOString();
  await page.route('**/api/markets/overview', route => { marketCalls++; return route.fulfill({ json: { quotes: [], generatedAt: stamp } }); });
  await page.route('**/api/news', route => { newsCalls++; return route.fulfill({ json: { articles: [], provider: 'Fixture', status: 'unavailable', cached: false, fetchedAt: null } }); });
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Market Dashboard', exact: true })).toBeVisible();
  await expect.poll(() => marketCalls).toBe(1);
  await expect.poll(() => newsCalls).toBe(1);
  await expect(page.getByRole('button', { name: /Telemetry auto-syncs/ })).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => marketCalls).toBe(2);
  await expect.poll(() => newsCalls).toBe(2);
  await expect(page.getByRole('heading', { name: 'Market Dashboard', exact: true })).toBeVisible();
});
