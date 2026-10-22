import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const target of ['server', 'vercel']) {
  test(`${target} CSP permits OneSignal configuration scripts but blocks unrelated scripts`, async ({ page, request }) => {
    const policy = target === 'server'
      ? (await request.get('/')).headers()['content-security-policy']
      : JSON.parse(readFileSync('.vercel/output/config.json', 'utf8')).routes[0].headers['Content-Security-Policy'];
    expect(policy).toBeTruthy();
    await page.route('**/push-csp-test', route => route.fulfill({
      contentType: 'text/html', headers: { 'Content-Security-Policy': policy }, body: '<!doctype html><title>Push CSP test</title>',
    }));
    await page.route('https://api.onesignal.com/sync/test/web?callback=test', route => route.fulfill({
      contentType: 'application/javascript', body: 'window.pushConfigLoaded = true;',
    }));
    await page.route('https://untrusted.example/script.js', route => route.fulfill({
      contentType: 'application/javascript', body: 'window.untrustedLoaded = true;',
    }));
    await page.goto('/push-csp-test');
    await page.addScriptTag({ url: 'https://api.onesignal.com/sync/test/web?callback=test' });
    expect(await page.evaluate(() => (window as unknown as { pushConfigLoaded: boolean }).pushConfigLoaded)).toBe(true);
    await expect(page.addScriptTag({ url: 'https://untrusted.example/script.js' })).rejects.toThrow();
    expect(await page.evaluate(() => (window as unknown as { untrustedLoaded?: boolean }).untrustedLoaded)).toBeUndefined();
  });
}
