import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { readConfig } from '../config';

// Contract tests deliberately run without credentials or third-party traffic.
for (const key of ['GEMINI_API_KEY', 'FINNHUB_API_KEY', 'UPSTOX_ANALYTICS_TOKEN', 'HUGGINGFACE_API_KEY', 'GOLD_API_KEY']) delete process.env[key];

async function withServer(run: (url: string) => Promise<void>, options: { production?: boolean; token?: string } = {}) {
  const app = createApp(readConfig({ NODE_ENV: 'test', AI_ACCESS_TOKEN: options.token }), options.production ?? false);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(url, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('health returns configuration and security headers without provider credentials', async () => {
  await withServer(async url => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.aiAccess, 'local');
    assert.ok(data.providers.find((provider: { id: string; status: string }) => provider.id === 'gemini' && provider.status === 'missing-key'));
    assert.ok(data.providers.every((provider: object) => !('key' in provider) && !('token' in provider)));
  });
});
test('unknown API route never returns SPA HTML', async () => {
  await withServer(async url => {
    const response = await fetch(`${url}/api/does-not-exist`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'NOT_FOUND');
  });
});
test('invalid history symbols/ranges fail before contacting providers', async () => {
  await withServer(async url => {
    assert.equal((await fetch(`${url}/api/markets/history/UNKNOWN`)).status, 404);
    assert.equal((await fetch(`${url}/api/markets/history/BTC?range=banana`)).status, 400);
  });
});
test('analysis validates input and explicitly reports missing engine keys', async () => {
  await withServer(async url => {
    assert.equal((await post(`${url}/api/ai/analyze`, { headline: 'hello', engine: 'fake' })).status, 400);
    assert.equal((await post(`${url}/api/ai/analyze`, { headline: 'Revenue rises', engine: 'gemini', priceContext: { price: 12 } })).status, 400);
    for (const engine of ['gemini', 'finbert']) {
      const response = await post(`${url}/api/ai/analyze`, { headline: 'Revenue rises in the quarter', engine });
      assert.equal(response.status, 503);
      const data = await response.json();
      assert.equal(data.engineStatus, 'unavailable');
      assert.equal(data.engine, engine);
      assert.equal(data.signal, undefined);
    }
  });
});
test('scenario rejects short inputs and never synthesizes an impact without AI', async () => {
  await withServer(async url => {
    assert.equal((await post(`${url}/api/ai/scenario`, { scenario: 'hi' })).status, 400);
    const response = await post(`${url}/api/ai/scenario`, { scenario: 'Federal Reserve cuts rates by 100 bps' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).engineStatus, 'unavailable');
  });
});
test('production AI is disabled until protected with an application token', async () => {
  await withServer(async url => {
    const response = await post(`${url}/api/ai/analyze`, { headline: 'Revenue rises' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'AI_ACCESS_DISABLED');
    const health = await fetch(`${url}/api/health`);
    assert.ok(health.headers.get('content-security-policy')?.includes("script-src 'self'"));
  }, { production: true });
});
test('application authentication gates AI but leaves market health public', async () => {
  await withServer(async url => {
    const body = { headline: 'Revenue rises', engine: 'gemini' };
    assert.equal((await post(`${url}/api/ai/analyze`, body)).status, 401);
    assert.equal((await post(`${url}/api/ai/analyze`, body, { authorization: 'Bearer incorrect' })).status, 401);
    const allowed = await post(`${url}/api/ai/analyze`, body, { authorization: 'Bearer test-access-token' });
    assert.equal(allowed.status, 503); // Missing provider key after successful application authentication.
    assert.equal((await allowed.json()).code, 'AI_NOT_CONFIGURED');
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
  }, { production: true, token: 'test-access-token' });
});
test('invalid JSON and oversized bodies return safe JSON errors', async () => {
  await withServer(async url => {
    const invalid = await fetch(`${url}/api/ai/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, 'INVALID_INPUT');
    const oversized = await post(`${url}/api/ai/analyze`, { headline: 'x'.repeat(17_000) });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'INVALID_INPUT');
  });
});
test('AI route rate limit returns structured 429 responses', async () => {
  await withServer(async url => {
    for (let i = 0; i < 10; i++) await post(`${url}/api/ai/analyze`, {});
    const limited = await post(`${url}/api/ai/analyze`, {});
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).code, 'RATE_LIMITED');
    assert.ok(limited.headers.get('retry-after'));
  });
});
test('configuration rejects invalid port and placeholder secrets without echoing values', () => {
  assert.throws(() => readConfig({ PORT: '-1' }), /PORT/);
  assert.throws(() => readConfig({ GEMINI_API_KEY: 'MY_SECRET' }), error => error instanceof Error && !error.message.includes('MY_SECRET'));
});
