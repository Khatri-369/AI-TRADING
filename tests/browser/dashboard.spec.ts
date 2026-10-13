import { test, expect } from '@playwright/test';

test('desktop navigation, search, asset detail, chart table alternative, themes and clean URLs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 1. Overview Page
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Market Intelligence', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'RELIANCE', exact: false }).first()).toBeVisible({ timeout: 15000 });

  // 2. Navigation to Markets Page
  await page.getByRole('tab', { name: 'Markets' }).click();
  await expect(page).toHaveURL(/\/markets/);
  await expect(page.getByRole('heading', { name: 'Markets Directory' })).toBeVisible();

  // 3. Search for RELIANCE
  await page.getByRole('searchbox').fill('RELIANCE');
  await expect(page.getByText('matching instruments out of 42 tracked assets')).toBeVisible();

  // 4. Open Asset Detail for RELIANCE
  await page.route('**/api/markets/candles/RELIANCE*', (route) =>
    route.fulfill({
      json: {
        symbol: 'RELIANCE',
        interval: '1d',
        range: '1M',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        provider: 'upstox',
        status: 'cached',
        cached: true,
        fetchedAt: '2026-10-13T10:00:00Z',
        note: 'Provider candles; the latest bar may be unfinished.',
        candles: [
          { time: '2026-09-15T09:15:00Z', open: 2900.0, high: 2920.0, low: 2895.0, close: 2910.5, volume: 1200000 },
          { time: '2026-09-22T09:15:00Z', open: 2915.0, high: 2950.0, low: 2910.0, close: 2945.0, volume: 1500000 },
          { time: '2026-09-29T09:15:00Z', open: 2940.0, high: 2990.0, low: 2935.0, close: 2980.25, volume: 1800000 },
          { time: '2026-10-06T09:15:00Z', open: 2985.0, high: 3020.0, low: 2975.0, close: 3012.0, volume: 2100000 },
        ],
      },
    })
  );
  await page.route('**/api/markets/history/RELIANCE?range=1M', (route) =>
    route.fulfill({
      json: {
        symbol: 'RELIANCE',
        range: '1M',
        currency: 'INR',
        points: [
          { time: '2026-09-15T09:15:00Z', price: 2910.5 },
          { time: '2026-09-22T09:15:00Z', price: 2945.0 },
          { time: '2026-09-29T09:15:00Z', price: 2980.25 },
          { time: '2026-10-06T09:15:00Z', price: 3012.0 },
        ],
        provider: 'upstox',
        status: 'cached',
        fetchedAt: '2026-10-13T10:00:00Z',
        cached: true,
      },
    })
  );
  await page.getByRole('button', { name: 'RELIANCE', exact: true }).first().click();
  await expect(page).toHaveURL(/\/asset\/RELIANCE/);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'RELIANCE' })).toBeVisible();

  // 5. Historical Recharts Surface and Range Selection
  await expect(dialog.locator('.recharts-surface')).toBeVisible();
  // Explicit empty-session fixture: before the market opens, intraday candles
  // may legitimately be absent. Exercise that state without clock dependence.
  await page.route('**/api/markets/history/RELIANCE?range=1D', (route) =>
    route.fulfill({
      json: {
        symbol: 'RELIANCE',
        range: '1D',
        currency: 'INR',
        points: [],
        provider: 'upstox',
        status: 'unavailable',
        fetchedAt: null,
        cached: false,
        error: 'No intraday candles are available for this session.',
      },
    })
  );
  await dialog.getByRole('button', { name: '1D', exact: true }).click();
  await expect(dialog.getByText('Historical data unavailable', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '1M', exact: true }).click();
  await expect(dialog.locator('.recharts-surface')).toBeVisible();

  // 6. Test Text / Table Alternative for Chart Data
  await dialog.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'RELIANCE historical price table data alternative' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Price' })).toBeVisible();

  // Switch back to Chart
  await dialog.getByRole('button', { name: 'Chart', exact: true }).click();
  await expect(dialog.locator('.recharts-surface')).toBeVisible();

  // 6b. Test Interactive Candlestick Workspace with Drawing Tools & Mobile Ergonomics
  await dialog.getByRole('button', { name: 'Candles', exact: true }).click();
  await expect(dialog.getByLabel('RELIANCE interactive candlestick chart')).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Drawing tools' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'level', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'trend', exact: true })).toBeVisible();
  await expect(dialog.getByText('Navigation Mode')).toBeVisible();
  await expect(dialog.getByText(/Warm-up: Requires 20 completed candles/)).toBeVisible();
  await expect(dialog.getByText('Saved locally on this device')).toBeVisible();

  // Test mode separation: selecting trend switches to drawing mode
  await dialog.getByRole('button', { name: 'trend', exact: true }).click();
  await expect(dialog.getByText('Drawing: TREND')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done drawing' }).click();
  await expect(dialog.getByText('Navigation Mode')).toBeVisible();

  // Test accessible candle table toggle
  await dialog.getByRole('button', { name: 'Candle table', exact: true }).click();
  await expect(dialog.getByRole('columnheader', { name: 'Open' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Close' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Show candles', exact: true }).click();

  // Return to line chart
  await dialog.getByRole('button', { name: 'Chart', exact: true }).click();
  await expect(dialog.locator('.recharts-surface')).toBeVisible();

  // 7. Close dialog via Escape key
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Clear search
  await page.getByRole('searchbox').fill('');

  // 8. Navigation to other focused pages
  await page.getByRole('tab', { name: 'News & Sentiment' }).click();
  await expect(page).toHaveURL(/\/news/);
  await expect(page.getByRole('heading', { name: 'Financial News & Sentiment' })).toBeVisible();

  await page.getByRole('tab', { name: 'Scenarios' }).click();
  await expect(page).toHaveURL(/\/scenarios/);
  await expect(page.getByRole('heading', { name: 'Macro Scenario Laboratory' })).toBeVisible();

  await page.getByRole('tab', { name: 'Diagnostics' }).click();
  await expect(page).toHaveURL(/\/diagnostics/);
  await expect(page.getByRole('heading', { name: 'Provider connections & diagnostics' })).toBeVisible();
  await expect(page.getByText('Upstox · Indian equities and indices', { exact: true })).toBeVisible();

  // 8b. Navigation to Research Desk and Trade-Planning Workspace
  await page.getByRole('tab', { name: 'Research desk' }).click();
  await expect(page).toHaveURL(/\/desk/);
  await expect(page.getByRole('heading', { name: 'Research desk' })).toBeVisible();

  // Switch to Plan Tab
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: /New Trade Plan/ })).toBeVisible();
  await expect(page.getByText('Interactive Chart Workspace')).toBeVisible();

  // Enter Trade Plan Numerical Levels
  await page.getByLabel('Intended entry').fill('2900');
  await page.getByLabel(/Stop level/).fill('2850');
  await page.getByLabel(/Target/).fill('3050');
  await expect(page.getByText('✓ Valid Long (Stop < Entry < Target)')).toBeVisible();

  // Sizing via hypothetical loss budget
  await page.getByLabel(/Loss budget/).fill('5000');
  await page.getByRole('button', { name: 'Derive whole units from budget' }).click();

  // Fill thesis, evidence, invalidation
  await page.getByPlaceholder(/Why this trade/).fill('Weekly cup and handle breakout with strong volume');
  await page.getByPlaceholder(/e.g., 200 EMA support/).fill('20 EMA support confluence');
  await page.getByPlaceholder(/Specific price action or events/).fill('Close below 2850 stop level');

  // Verify calculation summary
  await expect(page.getByText('Transparent Calculation Summary')).toBeVisible();
  await expect(page.getByText(/Reward \/ Risk Ratio:/)).toBeVisible();

  // Save the trade plan
  await page.getByRole('button', { name: 'Save trade plan' }).click();
  await expect(page.getByText('Saved Trade Plans (1)')).toBeVisible();
  await expect(page.getByText('Weekly cup and handle breakout with strong volume')).toBeVisible();

  // 9. Light and Dark Theme Persistence
  await page.goto('/');
  const initialTheme = (await page.locator('html').getAttribute('data-theme')) ?? 'dark';
  const oppositeTheme = initialTheme === 'dark' ? 'light' : 'dark';

  // Toggle to opposite theme
  await page.getByRole('button', { name: new RegExp(`Switch to ${oppositeTheme}`, 'i') }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', oppositeTheme);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-results/${oppositeTheme}-theme.png` });

  // Toggle back to initial theme
  await page.getByRole('button', { name: new RegExp(`Switch to ${initialTheme}`, 'i') }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-results/${initialTheme}-theme.png` });

  // 10. Direct Link Test: navigate directly to /asset/AAPL
  await page.goto('/asset/AAPL');
  const directDialog = page.getByRole('dialog');
  await expect(directDialog).toBeVisible();
  await expect(directDialog.getByRole('heading', { name: 'AAPL' })).toBeVisible();
  await directDialog.getByRole('button', { name: 'Close' }).click();
  await expect(directDialog).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('responsive layouts at 320px, 390px, 768px, and 1440px have zero horizontal overflow', async ({ page }) => {
  const breakpoints = [
    { width: 320, height: 600, name: '320' },
    { width: 390, height: 844, name: '390' },
    { width: 768, height: 1024, name: '768' },
    { width: 1440, height: 900, name: '1440' },
  ];

  for (const bp of breakpoints) {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Market Intelligence', exact: true })).toBeVisible();

    // Assert strictly no horizontal overflow
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);

    await page.screenshot({ path: `test-results/viewport-${bp.name}.png` });
  }

  // Mobile menu interactions on 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation menu' }).click();
  }

  // Provider Settings on Mobile
  await page.getByRole('button', { name: 'Provider settings' }).click();
  await expect(page.getByRole('heading', { name: 'Provider connections & diagnostics' })).toBeVisible();
  const settingsNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(settingsNoOverflow).toBe(true);
});
