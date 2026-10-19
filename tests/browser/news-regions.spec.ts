import { test, expect } from '@playwright/test';

test('Indian and global feeds retain region filters, relevance evidence and chart links on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/workspace/session', route => route.fulfill({ json: { user: null } }));
  await page.route('**/api/markets/overview', route => route.fulfill({ json: { quotes: [], generatedAt: new Date().toISOString() } }));
  await page.route('**/api/stream/live-ticks', route => route.abort());
  await page.route('**/api/news', route => route.fulfill({ json: { provider: 'Fixture', status: 'live', cached: false, fetchedAt: new Date().toISOString(), articles: [
    { id: 'india', headline: 'Reliance Industries refinery expansion announced', source: 'India fixture', url: 'https://example.com/india', publishedAt: new Date().toISOString(), summary: '', region: 'india', relatedAssets: ['RELIANCE'], stockLinks: [{ symbol: 'RELIANCE', basis: 'mention', evidence: 'Mentioned in headline: Reliance Industries' }] },
    { id: 'global', headline: 'Microsoft unveils Azure infrastructure investment', source: 'Global fixture', url: 'https://example.com/global', publishedAt: new Date().toISOString(), summary: '', region: 'global', relatedAssets: ['MSFT'], stockLinks: [{ symbol: 'MSFT', basis: 'provider', evidence: 'Linked by news provider' }] },
  ] } }));
  await page.goto('/news');
  await expect(page.getByText('Reliance Industries refinery expansion announced', { exact: true })).toBeVisible();
  await expect(page.getByText('Microsoft unveils Azure infrastructure investment', { exact: true })).toBeVisible();
  await page.getByLabel('News region').selectOption('india');
  await expect(page.getByText('Microsoft unveils Azure infrastructure investment', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'RELIANCE', exact: true })).toHaveAttribute('title', /Mentioned in headline/);
  await page.getByLabel('News region').selectOption('global');
  await expect(page.getByText('Reliance Industries refinery expansion announced', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'MSFT', exact: true }).click();
  await expect(page).toHaveURL(/\/desk\?symbol=MSFT$/);
});
