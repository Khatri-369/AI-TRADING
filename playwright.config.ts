import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const port = process.env.PORT || '3000';
const baseURL = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    // CI portability: Use standard Playwright Chromium in CI unless a channel is explicitly requested.
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : isCI
      ? {}
      : { channel: 'msedge' }),
  },
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'node dist/server.js --production',
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
