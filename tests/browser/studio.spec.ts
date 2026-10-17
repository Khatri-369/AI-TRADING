import { test, expect } from '@playwright/test';
import { ASSETS } from '../../shared/assets';

for (const theme of ['light', 'dark']) test(`research studio responsive navigation and watchlist in ${theme}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => localStorage.setItem('theme', value), theme);
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.route('**/api/markets/overview', route => route.fulfill({ json: {
    generatedAt: new Date().toISOString(),
    quotes: ASSETS.map((asset, i) => ({ ...asset, price: 1234 + i * 107, change: 12, changePercent: i % 3 ? 1.24 : -0.81, volume: 100000, status: 'delayed', cached: false, provider: 'UI test fixture', asOf: new Date().toISOString(), fetchedAt: new Date().toISOString(), session: { state: 'CLOSED', timezone: 'UTC' } })),
  } }));
  await page.route('**/api/news', route => route.fulfill({ json: { articles: [
    { id: 'studio-news', headline: 'Test headline: what to watch in the next market session', source: 'UI test fixture', publishedAt: new Date().toISOString(), url: 'https://example.com/test-news', summary: 'A deterministic preview for testing the news layout.', relatedAssets: ['RELIANCE'] },
  ], status: 'delayed', provider: 'UI test fixture', cached: false, fetchedAt: new Date().toISOString() } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Market Dashboard' })).toBeVisible();
  await expect(page.locator('.studio-benchmark')).toHaveCount(7);
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('heading', { name: 'Market Dashboard' }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.locator('.studio-search').boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    for (const panel of await page.locator('.studio-surface, .studio-benchmarks-section, .studio-resume').all()) {
      const box = await panel.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: `test-results/studio-${theme}-${width}.png`, fullPage: true });
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/studio-preview-${theme}-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Explore markets', exact: true }).getByRole('button', { name: 'India', exact: true }).click();
  await page.getByRole('button', { name: 'Save RELIANCE to watchlist', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Personal watchlist' }).getByText('RELIANCE', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Personal watchlist' }).getByText('RELIANCE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'Provider settings' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('button', { name: 'News & Sentiment' }).click();
  await expect(page).toHaveURL(/\/news$/);
  await page.goto('/desk');
  await page.getByRole('combobox', { name: 'Instrument', exact: true }).selectOption('TCS');
  await page.getByRole('button', { name: 'Tradexa Global Markets Research', exact: true }).click();
  await page.getByRole('button', { name: 'Open TCS Chart', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Instrument', exact: true })).toHaveValue('TCS');
  expect(errors).toEqual([]);
});
