import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`mobile watchlist, news and tools form a complete flow in ${theme}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    const quotes = ['NIFTY50', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY'].map((symbol, i) => ({ symbol, name: symbol, category: 'india', currency: 'INR', price: 1000 + i, change: 10, changePercent: 1, volume: null, asOf: '2026-10-13T10:00:00Z', fetchedAt: '2026-10-13T10:00:00Z', provider: 'Test fixture', cached: false, status: 'delayed', session: { state: 'CLOSED', timezone: 'Asia/Kolkata' } }));
    await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes, generatedAt: '2026-10-13T10:00:00Z' } }));
    await page.route('**/api/stream/live-ticks', route => route.abort());
    await page.route('**/api/news', route => route.fulfill({ json: { articles: [
      { id: 'reliance', headline: 'Reliance market update', summary: 'A fixture for testing the watchlist news filter.', source: 'Test source', url: 'https://example.com/reliance', publishedAt: '2026-10-13T10:00:00Z', relatedAssets: ['RELIANCE'] },
      { id: 'tcs', headline: 'TCS earnings update', summary: 'A second test headline.', source: 'Test source', url: 'https://example.com/tcs', publishedAt: '2026-10-13T10:00:00Z', relatedAssets: ['TCS'] },
    ], provider: 'Test fixture', status: 'delayed', cached: false, fetchedAt: '2026-10-13T10:00:00Z' } }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Watchlist', exact: true })).toBeVisible();
    await expect(page.getByLabel('Watchlist cards').getByRole('article')).toHaveCount(6);
    await expect(page.getByLabel('NIFTY50 quote')).toContainText('1,000');
    await expect(page.getByLabel('NIFTY50 quote')).toContainText('Closed');
    await expect(page.getByLabel('NIFTY50 quote')).toContainText('delayed');
    const nav = page.getByRole('navigation', { name: 'Mobile bottom navigation' });
    await expect(nav.getByRole('button')).toHaveCount(4);
    await expect(nav.getByRole('button', { name: 'Watchlist' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Market Intelligence' })).toHaveCount(0);
    const card = await page.getByLabel('NIFTY50 quote').boundingBox();
    expect(card!.y + card!.height).toBeLessThan(650);
    const bot = await page.getByRole('button', { name: 'Open market assistant' }).boundingBox();
    const bottom = await nav.boundingBox();
    expect(bot!.y + bot!.height).toBeLessThanOrEqual(bottom!.y);
    await page.screenshot({ path: `test-results/mobile-home-${theme}.png`, fullPage: true });

    for (const width of [320, 768, 1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('button', { name: 'Save RELIANCE', exact: true }).click();
    await expect(page.getByLabel('Watchlist cards').getByRole('article')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Unsave RELIANCE', exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await nav.getByRole('button', { name: 'News', exact: true }).click();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'My watchlist', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reliance market update' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'TCS earnings update' })).toHaveCount(0);
    await page.screenshot({ path: `test-results/mobile-news-${theme}.png`, fullPage: true });
    await page.setViewportSize({ width: 320, height: 680 });
    await page.getByLabel('Analysis settings', { exact: true }).click();
    const settings = await page.getByText('Analysis runs only when you request it and may be unavailable.', { exact: true }).boundingBox();
    expect(settings!.x).toBeGreaterThanOrEqual(0);
    expect(settings!.x + settings!.width).toBeLessThanOrEqual(320);
    await page.getByLabel('Analysis settings', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await nav.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.screenshot({ path: `test-results/mobile-tools-${theme}.png`, fullPage: true });
    await page.getByRole('button', { name: /^Trading journal/ }).click();
    await expect(page).toHaveURL(/\/desk\?tab=Journal/);
    await expect(page.getByRole('heading', { name: 'Record a completed trade · manual entry' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();

    await nav.getByRole('button', { name: 'Watchlist' }).click();
    await page.getByRole('button', { name: 'Add symbols', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Find watchlist instruments' }).fill('TCS');
    await page.getByRole('button', { name: 'Save TCS', exact: true }).click();
    await page.getByRole('button', { name: 'Back to watchlist' }).click();
    await expect(page.getByLabel('Watchlist cards').getByRole('article')).toHaveCount(2);
    await page.getByRole('button', { name: 'Unsave TCS', exact: true }).click();
    await page.getByRole('button', { name: 'Unsave RELIANCE', exact: true }).click();
    await expect(page.getByText('Starter list', { exact: false })).toBeVisible();
    await nav.getByRole('button', { name: 'News', exact: true }).click();
    await page.getByRole('button', { name: 'My watchlist', exact: true }).click();
    await expect(page.getByText('No headlines for your watchlist', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('home keeps instruments visible without inventing unavailable prices', async ({ page }) => {
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes: [], generatedAt: null } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.goto('/');
  await expect(page.getByLabel('Watchlist cards').getByRole('article')).toHaveCount(6);
  await expect(page.getByLabel('RELIANCE quote').getByText('No price available')).toBeVisible();
  await expect(page.getByLabel('RELIANCE quote').getByRole('button', { name: 'View RELIANCE price details' })).toContainText('Unavailable');
});
