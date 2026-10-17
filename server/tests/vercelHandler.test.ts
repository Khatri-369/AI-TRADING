import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../vercelHandler';

test('Vercel fails closed without a session secret and returns a sanitized configuration error', () => {
  const saved = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  let body = '';
  const response = { headersSent: false, statusCode: 200, setHeader() {}, removeHeader() {}, end(value: string) { body = value; } };
  try {
    handler({ headers: {}, url: '/api/health' } as IncomingMessage, response as unknown as ServerResponse);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(body), { error: 'Serverless initialization failed', message: 'Check the backend environment configuration, including SESSION_SECRET.' });
    assert.doesNotMatch(body, /fallback-session-secret|development-session-secret/);
  } finally {
    if (saved === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = saved;
  }
});
