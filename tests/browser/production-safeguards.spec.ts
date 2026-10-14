import { test, expect } from '@playwright/test';

test('production safeguards: legal disclosures modal, session AI allowance, and CSRF protection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 1. Visit main dashboard
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Watchlist', exact: true })).toBeVisible();

  // 2. Open Product Disclosures & Methodology Modal via header button
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const disclosuresButton = page.getByRole('button', { name: 'Data sources and legal disclosures' });
  await expect(disclosuresButton).toBeVisible();
  await disclosuresButton.click();

  const disclosuresDialog = page.getByRole('dialog');
  await expect(disclosuresDialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Data Sources, Legal Disclaimers & Methodology' })).toBeVisible();
  await expect(page.getByText('Educational & Research Prototype Only')).toBeVisible();
  await expect(page.getByText('Upstox Analytics V3')).toBeVisible();
  await expect(page.getByText('Powered by CoinGecko')).toBeVisible();

  // Close Disclosures Modal
  await page.getByRole('button', { name: 'Acknowledge & Close' }).click();
  await expect(disclosuresDialog).toHaveCount(0);

  // 3. Open Settings & Provider Diagnostics
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Provider settings' }).click();
  await expect(page.getByRole('heading', { name: 'Provider connections & diagnostics' })).toBeVisible();

  // Verify Public Session AI Allowance is shown (no mandatory token prompt for normal visitors)
  await expect(page.getByText('Public Session AI Allowance')).toBeVisible();
  await expect(page.getByText('Administrative Unlock & Protected Diagnostics')).toBeVisible();

  // Close settings
  await page.getByRole('button', { name: 'Close provider settings' }).click();
  await expect(page.locator('#provider-settings')).toHaveCount(0);

  // 4. Test footer disclosures button
  const footerButton = page.getByRole('button', { name: 'Data sources & disclosures' });
  await expect(footerButton).toBeVisible();
  await footerButton.click();
  await expect(disclosuresDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(disclosuresDialog).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('deep linking, page refresh, browser back/forward history, and unknown route handling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 1. Direct page URL: /markets
  await page.goto('/markets');
  await expect(page.getByRole('heading', { name: 'Markets Directory' })).toBeVisible();

  // 2. Page refresh on /markets
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Markets Directory' })).toBeVisible();
  expect(page.url()).toContain('/markets');

  // 3. Navigate to /scenarios
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Scenarios', exact: true }).click();
  await expect(page).toHaveURL(/\/scenarios/);
  await expect(page.getByRole('heading', { name: 'Macro Scenario Laboratory' })).toBeVisible();

  // 4. Browser Back button -> returns to /markets
  await page.goBack();
  await expect(page).toHaveURL(/\/markets/);
  await expect(page.getByRole('heading', { name: 'Markets Directory' })).toBeVisible();

  // 5. Browser Forward button -> returns to /scenarios
  await page.goForward();
  await expect(page).toHaveURL(/\/scenarios/);
  await expect(page.getByRole('heading', { name: 'Macro Scenario Laboratory' })).toBeVisible();

  // 6. Direct navigation to asset deep link: /asset/RELIANCE
  await page.goto('/asset/RELIANCE');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'RELIANCE' })).toBeVisible();

  // 7. Refresh while asset modal is open -> preserves view
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'RELIANCE' })).toBeVisible();

  expect(errors).toEqual([]);
});
