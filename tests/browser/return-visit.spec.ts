import { test, expect, type Page } from '@playwright/test';

const stamp = '2026-10-13T10:00:00Z';
const story = { id: 'story-1', headline: 'Reliance results explained', summary: 'Test story summary.', source: 'Fixture source', url: 'https://example.com/reliance', publishedAt: stamp, relatedAssets: ['RELIANCE'] };
async function fixtures(page: Page) {
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes: [], generatedAt: stamp } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/news', route => route.fulfill({ json: { articles: [story], provider: 'Fixture', status: 'delayed', cached: false, fetchedAt: stamp } }));
  await page.route('**/api/markets/history/**', route => route.fulfill({ json: { symbol: 'RELIANCE', range: '1M', currency: 'INR', points: [], provider: 'Fixture', status: 'unavailable', fetchedAt: null, cached: false } }));
}

for (const theme of ['light', 'dark']) test(`return visit preserves reading list, recent charts and brief preferences in ${theme}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await fixtures(page);
  await page.addInitScript(value => localStorage.setItem('theme', value), theme);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/news');
  await page.getByRole('button', { name: `Save story: ${story.headline}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await page.getByLabel('Unread only').check();
  await expect(page.getByText('No unread stories in this view', { exact: true })).toBeVisible();
  await page.getByLabel('Unread only').uncheck();
  await page.getByRole('button', { name: 'Mark unread', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await page.getByRole('button', { name: 'Open RELIANCE from headline' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Mobile bottom navigation' }).getByRole('button', { name: 'Watchlist' }).click();
  await expect(page.getByRole('region', { name: 'Recent charts' }).getByRole('button', { name: 'RELIANCE' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide market brief' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your market brief' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show my market brief' }).click();
  await page.getByRole('heading', { name: 'Your market brief' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/personal-brief-${theme}.png` });
  await page.getByRole('button', { name: 'Clear reading history' }).click();
  await expect(page.getByRole('region', { name: 'Recent charts' })).toHaveCount(0);
  await expect(page.getByText('1 unread story in this feed')).toBeVisible();

  // A saved snapshot survives the provider removing it from the current feed.
  await page.route('**/api/news', route => route.fulfill({ json: { articles: [], provider: 'Fixture', status: 'unavailable', cached: false, fetchedAt: null } }));
  await page.getByRole('button', { name: 'Reading list (1)' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: story.headline })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toBeEnabled();
  await page.screenshot({ path: `test-results/reading-list-${theme}.png`, fullPage: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: `Unsave story: ${story.headline}`, exact: true }).click();
  await expect(page.getByText('Your reading list starts here', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('reading actions report storage failure without claiming a successful save', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('tradexa.reading.')) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/news');
  await page.getByRole('button', { name: `Save story: ${story.headline}`, exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Your change was not saved');
  await expect(page.getByRole('button', { name: 'Saved (0)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Save story: ${story.headline}`, exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('reading feed is bounded, sharing is explicit and account libraries stay separate', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { document.documentElement.dataset.sharedUrl = value; } }, configurable: true });
  });
  const articles = Array.from({ length: 25 }, (_, i) => ({ ...story, id: `story-${i}`, headline: `Story ${i}` }));
  await page.route('**/api/news', route => route.fulfill({ json: { articles, provider: 'Fixture', status: 'delayed', cached: false, fetchedAt: stamp } }));
  await page.goto('/news');
  const feed = page.getByRole('region', { name: 'Market news' });
  await expect(feed.getByRole('article')).toHaveCount(12);
  await page.getByRole('button', { name: 'Show more headlines' }).click();
  await expect(feed.getByRole('article')).toHaveCount(24);
  await page.getByRole('button', { name: 'Share story: Story 0', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-shared-url', story.url);
  await page.getByRole('button', { name: 'Save story: Story 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved (1)', exact: true })).toBeVisible();
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: { id: 902, username: 'other-account' } } }));
  await page.route('**/api/workspace/records', route => route.fulfill({ json: { records: [] } }));
  await page.goto('/news?view=saved');
  await expect(page.getByRole('button', { name: 'Saved (0)', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Story 0 \(opens in a new tab\)$/ })).toHaveCount(0);
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Story 0 \(opens in a new tab\)$/ })).toBeVisible();
});

test('brief uses watchlist evidence and excludes stale and incompatible movers', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => localStorage.setItem('markets.research.v1', JSON.stringify([{ id: 'user-watchlist', kind: 'watchlist', version: 1, updatedAt: '2026-10-13T10:00:00Z', data: { symbols: ['RELIANCE', 'TCS', 'BTC'] } }])));
  const base = { name: 'Fixture', currency: 'INR', volume: null, change: 1, price: 100, asOf: stamp, fetchedAt: stamp, cached: false, provider: 'Fixture', session: { state: 'CLOSED', timezone: 'Asia/Kolkata' } };
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { generatedAt: stamp, quotes: [
    { ...base, symbol: 'RELIANCE', category: 'india', changePercent: -2, status: 'delayed' },
    { ...base, symbol: 'TCS', category: 'india', changePercent: 99, status: 'stale' },
    { ...base, symbol: 'BTC', category: 'crypto', changePercent: 12, status: 'live' },
  ] } }));
  await page.goto('/');
  const brief = page.getByRole('region', { name: 'Your market brief' });
  await expect(brief.getByText('Based on your watchlist')).toBeVisible();
  const mover = brief.getByRole('button', { name: /Largest reported equity move/ });
  await expect(mover).toContainText('RELIANCE');
  await expect(mover).toContainText('-2.00%');
  await expect(mover).toContainText('delayed');
  await expect(mover).toContainText('vs previous close');
  await expect(mover).not.toContainText('TCS');
  await expect(mover).not.toContainText('BTC');
});
