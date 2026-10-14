import { test, expect } from '@playwright/test';

test('desktop installation and news opt-in disclose missing setup without prompting permission', async ({ page, request }) => {
  await page.route('**/api/notifications/config', route => route.fulfill({ json: { configured: false, publicKey: null, intervalMinutes: 5 } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Desktop app and news alerts' }).click();
  await expect(page.getByRole('heading', { name: 'Desktop app & news alerts' })).toBeVisible();
  await expect(page.getByText('Background alerts are not configured on this server yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable news alerts' })).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 680 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/desktop-settings-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Desktop app & news alerts' })).toBeHidden();
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  expect((await request.get('/icons/markets-192.png')).headers()['content-type']).toContain('image/png');
  expect((await request.get('/sw.js')).headers()['cache-control']).toContain('no-cache');
});
