import { test, expect } from '@playwright/test';

test('news alerts never substitute Apple or Microsoft for an unquoted related stock', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('markets.alerts.settings.v1', JSON.stringify({ enabled: true, device: false, scope: 'all', quiet: false }));
  });
  const quotes = ['AAPL', 'MSFT'].map(symbol => ({ symbol, name: symbol, category: 'us', currency: 'USD', price: 100, change: 1, changePercent: 1, volume: null, asOf: null, fetchedAt: null, provider: 'Fixture', status: 'delayed', cached: false, session: {state:'UNKNOWN',timezone:'UTC',note:''} }));
  await page.route('**/api/markets/overview', r => r.fulfill({json: {quotes, generatedAt: new Date().toISOString()}}));
  await page.route('**/api/news', r => r.fulfill({json: {articles:[{id:'tcs',headline:'TCS wins contract',summary:'',source:'Fixture',publishedAt:new Date().toISOString(),url:'https://example.com/tcs',relatedAssets:['TCS']}],provider:'Fixture',status:'live',cached:false,fetchedAt:new Date().toISOString()}}));
  await page.route('**/api/stream/live-ticks', r => r.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'News notifications', exact: true }).click();
  await page.getByRole('button', {name: /test/i}).filter({visible:true}).first().click();
  const alert = page.getByRole('status').filter({hasText:'TCS wins contract'});
  await expect(alert).toContainText('Related stocks: TCS');
  await expect(alert).not.toContainText('AAPL');
  await expect(alert).not.toContainText('MSFT');
});
