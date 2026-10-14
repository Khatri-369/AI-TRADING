import { test, expect } from '@playwright/test';

// Deterministic UI fixtures; real provider verification is performed separately.
for (const theme of ['light', 'dark']) {
  test(`research conversation and saved comparison work in ${theme} mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    const quotes = ['NIFTY50', 'BANKNIFTY', 'RELIANCE', 'TCS'].map((symbol, index) => ({ symbol, name: symbol, category: 'india', currency: 'INR', price: 100 + index, change: 1, changePercent: index, volume: null, asOf: '2026-10-13T10:00:00Z', fetchedAt: '2026-10-13T10:00:00Z', provider: 'Test provider', cached: false, status: 'delayed', session: { state: 'CLOSED', timezone: 'Asia/Kolkata' } }));
    await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes, generatedAt: '2026-10-13T10:00:00Z' } }));
    await page.route('**/api/news', route => route.fulfill({ json: { articles: [], provider: 'Test', status: 'unavailable', cached: false, fetchedAt: null } }));
    await page.route('**/api/stream/live-ticks', route => route.abort());
    let calls = 0;
    await page.route('**/api/ai/chat', async route => {
      calls++;
      if (calls === 3) expect(route.request().postDataJSON().symbols).toEqual(['RELIANCE']);
      if (calls === 2) { expect(route.request().postDataJSON().history).toHaveLength(2); await route.fulfill({ status: 429, json: { error: 'AI quota reached.', code: 'AI_RATE_LIMITED' } }); return; }
      await route.fulfill({ json: { answer: 'The supplied quote is delayed [quote:NIFTY50].', sourceIds: ['quote:NIFTY50'], followUps: ['What does delayed mean?'], limitations: ['No intraday trend evidence.'], sources: [{ id: 'quote:NIFTY50', label: 'NIFTY 50', provider: 'Upstox', asOf: '2026-10-13T10:00:00Z', status: 'delayed', url: '/asset/NIFTY50' }], generatedAt: '2026-10-13T10:00:00Z', cached: false, engine: 'gemini', engineStatus: 'available' } });
    });
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'AI Research' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open market assistant' }).click();
    await expect(page.getByRole('heading', { name: 'Market assistant', exact: true })).toBeVisible();
    await page.getByLabel('Your question', { exact: true }).fill('Explain NIFTY 50');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('The supplied quote is delayed [quote:NIFTY50].', { exact: true })).toBeVisible();
    await page.getByText('Sources used (1)').click();
    await expect(page.getByRole('link', { name: 'NIFTY 50', exact: true })).toHaveAttribute('href', '/asset/NIFTY50');
    await page.getByRole('button', { name: 'What does delayed mean?' }).click();
    await expect(page.getByRole('alert')).toContainText('AI quota reached');
    await expect(page.getByLabel('Your question', { exact: true })).toHaveValue('What does delayed mean?');
    await page.getByRole('tab', { name: 'Watchlist', exact: true }).click();
    await expect(page.getByText('The supplied quote is delayed [quote:NIFTY50].', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Market assistant' })).toBeHidden();
    await page.getByRole('button', { name: 'Open market assistant' }).click();
    await expect(page.getByText('The supplied quote is delayed [quote:NIFTY50].', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close market assistant' }).click();
    await page.getByRole('button', { name: 'Save RELIANCE', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Unsave RELIANCE', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add symbols', exact: true }).click();
    await page.getByLabel('Watchlist options', { exact: true }).click();
    await page.getByLabel('Compare instruments', { exact: true }).check();
    await page.getByLabel('Watchlist options', { exact: true }).click();
    for (const symbol of ['RELIANCE', 'NIFTY50', 'BANKNIFTY']) await page.getByLabel(`Compare ${symbol}`, { exact: true }).check();
    await expect(page.getByLabel('Compare TCS', { exact: true })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Compare instruments (3/3)' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/watchlist-${theme}.png`, fullPage: true });
    await page.goto('/research');
    await expect(page.getByRole('dialog', { name: 'Market assistant' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/research-${theme}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close market assistant' }).click();
    await page.goto('/asset/RELIANCE');
    await page.getByRole('button', { name: 'Ask about RELIANCE', exact: true }).click();
    await expect(page.getByText('Evidence focused on RELIANCE')).toBeVisible();
    await page.getByLabel('Your question', { exact: true }).fill('Explain this asset');
    await page.getByLabel('Your question', { exact: true }).press('Enter');
    await expect(page.getByText('The supplied quote is delayed [quote:NIFTY50].', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Use all markets' }).click();
    await expect(page.getByText('Evidence focused on RELIANCE')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
