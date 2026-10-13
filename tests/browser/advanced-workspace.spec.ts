import { test, expect, type Page } from '@playwright/test';

async function marketFixtures(page: Page) {
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes: [], generatedAt: '2026-10-13T10:00:00Z' } }));
  await page.route('**/api/news', route => route.fulfill({ json: { articles: [], provider: 'Test', status: 'unavailable', cached: false, fetchedAt: null } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.route('**/api/markets/candles/**', route => route.fulfill({ json: {
    symbol: 'RELIANCE', currency: 'INR', exchange: 'NSE', timezone: 'Asia/Kolkata', range: '1M', interval: '1d', provider: 'UI test fixture', status: 'delayed', cached: false, fetchedAt: '2026-10-13T10:00:00Z', note: 'Deterministic test candles',
    candles: Array.from({ length: 30 }, (_, i) => ({ time: new Date(Date.UTC(2026, 8, i + 1)).toISOString(), open: 100 + i, high: 103 + i, low: 99 + i, close: 102 + i, volume: 1000 })),
  } }));
}

for (const theme of ['light', 'dark']) test(`advanced guest workflows on phone and desktop in ${theme}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(value => localStorage.setItem('theme', value), theme);
  await marketFixtures(page);
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/ai/chat', async route => {
    const request = route.request().postDataJSON();
    expect(request.language).toBe('hi'); expect(request.focus.symbol).toBe('RELIANCE');
    expect(request.focus.interval).toBe('1d'); expect(request.focus.candles).toBeUndefined();
    await route.fulfill({ json: { answer: 'यह ऐतिहासिक चार्ट है [chart:RELIANCE]।', sourceIds: ['chart:RELIANCE'], sources: [{ id: 'chart:RELIANCE', label: 'RELIANCE chart', provider: 'test', status: 'delayed', asOf: null, url: '/asset/RELIANCE' }], followUps: [], limitations: ['Latest bar may be unfinished.'], generatedAt: '2026-10-13T10:00:00Z', cached: false, engine: 'gemini', engineStatus: 'available' } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/desk');
  await page.getByRole('button', { name: 'Ask assistant about this chart' }).click();
  await expect(page.getByText('Attached snapshot:', { exact: false })).toBeVisible();
  await page.getByLabel('Assistant language').selectOption('hi');
  await page.getByLabel('Your question', { exact: true }).fill('Explain my chart');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('यह ऐतिहासिक चार्ट है [chart:RELIANCE]।')).toBeVisible();
  await page.screenshot({ path: `test-results/advanced-chat-${theme}.png` });
  await page.getByRole('button', { name: 'Close market assistant' }).click();
  await page.getByRole('button', { name: 'Alerts', exact: true }).click();
  await page.getByLabel('Alert level', { exact: true }).fill('150');
  await page.getByLabel('Cooldown minutes').fill('30');
  await page.getByRole('button', { name: 'Save alert', exact: true }).click();
  await expect(page.getByText('RELIANCE crosses above 150 · Guest draft')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('RELIANCE crosses above 150 · Paused')).toBeVisible();
  await page.getByRole('button', { name: 'Save news preferences' }).click();
  await expect(page.getByText('Guest preferences saved. Sign in and import to activate.')).toBeVisible();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  for (const [field, value] of Object.entries({ entry: '100', exit: '110', quantity: '10', costs: '5' })) await page.getByLabel(`Journal ${field}`, { exact: true }).fill(value);
  await page.getByLabel('Tags', { exact: true }).fill('breakout');
  await page.getByLabel('I followed my plan').check();
  await page.getByRole('button', { name: 'Save journal entry' }).click();
  await expect(page.getByText('Win rate 100.0% · Plan adherence 100.0%')).toBeVisible();
  await expect(page.getByText('95.00', { exact: true })).toHaveCount(2);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `test-results/advanced-journal-${theme}.png`, fullPage: true });
  await page.reload(); await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(page.getByText('Win rate 100.0% · Plan adherence 100.0%')).toBeVisible();
  await page.getByLabel('Filter journal by symbol or tag').fill('no-match');
  await expect(page.getByText('Record a completed trade to start reviewing your process.')).toBeVisible();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simulate market buy' })).toBeDisabled();
  await expect(page.getByText('INR · Available virtual cash 100000.00', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('account watchlist syncs to a second device and never merges private data into guest storage', async ({ page, browser, baseURL }) => {
  const username = `browser_${Date.now()}`;
  const password = 'test-account-password-only';
  await marketFixtures(page);
  await page.goto('/desk');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password (12+ characters)', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible();
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  const saved = await page.request.post('/api/workspace/records/user-watchlist', { headers, data: { kind: 'watchlist', version: 0, data: { symbols: ['TCS'] } } });
  expect(saved.status()).toBe(200);
  const device = await browser.newContext({ baseURL });
  try {
    const login = await device.request.post('/api/workspace/login', { headers, data: { username, password } }); expect(login.status()).toBe(200);
    const records = await device.request.get('/api/workspace/records'); expect((await records.json()).records[0].data.symbols).toEqual(['TCS']);
    const stale = await device.request.post('/api/workspace/records/user-watchlist', { headers, data: { kind: 'watchlist', version: 0, data: { symbols: ['RELIANCE'] } } }); expect(stale.status()).toBe(409);
    const chart = await device.request.post('/api/workspace/records/chart-RELIANCE-default', { headers, data: { kind: 'chart', version: 0, data: { symbol: 'RELIANCE', interval: '1d', name: 'Across devices', drawings: [] } } }); expect(chart.status()).toBe(200);
    const secondPage = await device.newPage();
    await marketFixtures(secondPage);
    await secondPage.goto('/desk');
    await expect(secondPage.getByLabel('Layout name')).toHaveValue('Across devices');
    await secondPage.getByLabel('Layout name').fill('Synced chart edit');
    await secondPage.getByRole('button', { name: 'Save layout', exact: true }).click();
    await expect(secondPage.getByText('Account synced ·', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh synced data' }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
    const guest = await page.evaluate(() => [localStorage.getItem('markets.research.v1'), localStorage.getItem('markets.watchlist.v1')]);
    expect(guest.join('')).not.toContain('TCS');
  } finally {
    await device.request.post('/api/workspace/delete-account', { headers, data: { password } });
    await device.close();
  }
});
