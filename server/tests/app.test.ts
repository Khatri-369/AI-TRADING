import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app';
import { readConfig } from '../config';

// Contract tests deliberately run without credentials or third-party traffic.
for (const key of ['GEMINI_API_KEY', 'FINNHUB_API_KEY', 'UPSTOX_ANALYTICS_TOKEN', 'HUGGINGFACE_API_KEY', 'GOLD_API_KEY']) delete process.env[key];

async function withServer(
  run: (url: string) => Promise<void>,
  options: { production?: boolean; token?: string; anonymousQuota?: boolean } = {}
) {
  const isAnonymous = options.anonymousQuota ?? (!options.production && !options.token);
  const app = createApp(
    readConfig({
      NODE_ENV: 'test',
      ADMIN_DIAGNOSTICS_TOKEN: options.token,
      AI_ACCESS_TOKEN: options.token,
      ANONYMOUS_AI_QUOTA_ENABLED: String(isAnonymous),
    }),
    options.production ?? false
  );
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', ...headers },
    body: JSON.stringify(body),
  });

test('research endpoint validates input, rejects injected context and reports missing AI without market calls', async () => {
  await withServer(async url => {
    for (const body of [{ message: 'x' }, { message: 'Explain NIFTY', symbols: ['UNKNOWN'] }, { message: 'Explain NIFTY', evidence: { price: 999 } }]) {
      assert.equal((await post(`${url}/api/ai/chat`, body)).status, 400);
    }
    const response = await post(`${url}/api/ai/chat`, { message: 'Explain NIFTY' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'AI_NOT_CONFIGURED');
  });
});

test('research endpoint inherits production authorization and CSRF protection', async () => {
  await withServer(async url => {
    assert.equal((await post(`${url}/api/ai/chat`, { message: 'Explain NIFTY' })).status, 401);
    const response = await fetch(`${url}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer research-test-token' }, body: JSON.stringify({ message: 'Explain NIFTY' }) });
    assert.equal(response.status, 403);
  }, { production: true, token: 'research-test-token', anonymousQuota: false });
});

test('health returns configuration and security headers without provider credentials', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
    const data = await response.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.aiAccess, 'local');
    assert.ok(data.providers.find((provider: { id: string; status: string }) => provider.id === 'gemini' && provider.status === 'unconfigured'));
    assert.ok(data.providers.every((provider: object) => !('key' in provider) && !('token' in provider)));
  });
});

test('unknown API route never returns SPA HTML', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/does-not-exist`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'NOT_FOUND');
  });
});

test('invalid history symbols/ranges fail before contacting providers', async () => {
  await withServer(async (url) => {
    assert.equal((await fetch(`${url}/api/markets/history/UNKNOWN`)).status, 404);
    assert.equal((await fetch(`${url}/api/markets/history/BTC?range=banana`)).status, 400);
  });
});

test('analysis validates input and explicitly reports missing engine keys', async () => {
  await withServer(async (url) => {
    assert.equal((await post(`${url}/api/ai/analyze`, { headline: 'hello', engine: 'fake' })).status, 400);
    assert.equal(
      (await post(`${url}/api/ai/analyze`, { headline: 'Revenue rises', engine: 'gemini', priceContext: { price: 12 } }))
        .status,
      400
    );
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


test('production AI is disabled until protected with an application token', async () => {
  await withServer(
    async (url) => {
      const response = await post(`${url}/api/ai/analyze`, { headline: 'Revenue rises' });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'AI_ACCESS_DISABLED');
      const health = await fetch(`${url}/api/health`);
      assert.ok(health.headers.get('content-security-policy')?.includes("script-src 'self'"));
    },
    { production: true }
  );
});

test('application authentication gates AI but leaves market health public', async () => {
  await withServer(
    async (url) => {
      const body = { headline: 'Revenue rises', engine: 'gemini' };
      assert.equal((await post(`${url}/api/ai/analyze`, body)).status, 401);
      assert.equal((await post(`${url}/api/ai/analyze`, body, { authorization: 'Bearer incorrect' })).status, 401);
      const allowed = await post(`${url}/api/ai/analyze`, body, { authorization: 'Bearer test-access-token' });
      assert.equal(allowed.status, 503); // Missing provider key after successful application authentication.
      assert.equal((await allowed.json()).code, 'AI_NOT_CONFIGURED');
      assert.equal((await fetch(`${url}/api/health`)).status, 200);
    },
    { production: true, token: 'test-access-token' }
  );
});

test('invalid JSON and oversized bodies return safe JSON errors', async () => {
  await withServer(async (url) => {
    const invalid = await fetch(`${url}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      body: '{bad',
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, 'INVALID_INPUT');
    const oversized = await post(`${url}/api/ai/analyze`, { headline: 'x'.repeat(17_000) });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'INVALID_INPUT');
  });
});

test('CSRF protection rejects POST requests missing custom security header', async () => {
  await withServer(async (url) => {
    const noHeader = await fetch(`${url}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ headline: 'Testing security headers' }),
    });
    assert.equal(noHeader.status, 403);
    assert.equal((await noHeader.json()).code, 'CSRF_VERIFICATION_FAILED');
  });
});

test('AI quota endpoint returns daily limit status and remaining count', async () => {
  await withServer(async (url) => {
    const quotaRes = await fetch(`${url}/api/ai/quota`);
    assert.equal(quotaRes.status, 200);
    const data = await quotaRes.json();
    assert.equal(data.allowed, true);
    assert.equal(data.limit, 5);
    assert.equal(data.remaining, 5);
    assert.ok(data.resetInSeconds > 0);
  });
});

test('admin diagnostics endpoint is protected by ADMIN_DIAGNOSTICS_TOKEN', async () => {
  await withServer(
    async (url) => {
      // Without token
      const forbidden = await fetch(`${url}/api/admin/diagnostics`);
      assert.equal(forbidden.status, 401);

      // With incorrect token
      const badToken = await fetch(`${url}/api/admin/diagnostics`, {
        headers: { authorization: 'Bearer wrong-token' },
      });
      assert.equal(badToken.status, 401);

      // With correct admin token
      const allowed = await fetch(`${url}/api/admin/diagnostics`, {
        headers: { authorization: 'Bearer secret-admin-pass' },
      });
      assert.equal(allowed.status, 200);
      const data = await allowed.json();
      assert.equal(data.status, 'ok');
      assert.ok('system' in data);
      assert.ok('aiSpending' in data);
    },
    { token: 'secret-admin-pass' }
  );
});

test('AI route rate limit returns structured 429 responses', async () => {
  await withServer(async (url) => {
    for (let i = 0; i < 10; i++) await post(`${url}/api/ai/analyze`, {});
    const limited = await post(`${url}/api/ai/analyze`, {});
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).code, 'RATE_LIMITED');
    assert.ok(limited.headers.get('retry-after'));
  });
});

test('configuration rejects invalid port and placeholder secrets without echoing values', () => {
  assert.throws(() => readConfig({ PORT: '-1' }), /PORT/);
  assert.throws(
    () => readConfig({ GEMINI_API_KEY: 'MY_SECRET' }),
    (error) => error instanceof Error && !error.message.includes('MY_SECRET')
  );
});


test('production requires an explicit session secret even on Vercel', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production', VERCEL: '1' }), /SESSION_SECRET/);
});

test('cron and read-only push diagnostics reject missing or wrong Bearer credentials before provider calls', async () => {
  const saved = process.env.CRON_SECRET;process.env.CRON_SECRET='x'.repeat(32);
  try {await withServer(async url => {
    for(const endpoint of ['/api/cron/news','/api/notifications/diagnostics']) {
      for(const headers of [{}, {Authorization:'Basic wrong'}, {Authorization:'Bearer '+ 'y'.repeat(32)}] as Record<string, string>[]) {
        const response=await fetch(url+endpoint,{headers}); assert.equal(response.status,401);
      }
    }
    const invalid=await post(url+'/api/notifications/verify',{userId:'invalid',subscriptionId:'invalid'});
    assert.equal(invalid.status,400);
    const noCsrf=await fetch(url+'/api/notifications/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(noCsrf.status,403);
  });}finally{if(saved===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=saved;}
});
