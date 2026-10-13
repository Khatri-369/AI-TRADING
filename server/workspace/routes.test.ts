import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { workspaceRouter } from './routes';

test('workspace HTTP accounts isolate records across sessions and reject stale writes and CSRF', async () => {
  process.env.WORKSPACE_DB_PATH = ':memory:';
  delete process.env.VERCEL;
  const app = express(); app.use(express.json()); app.use('/api/workspace', workspaceRouter(false));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`;
  const post = (path: string, body: unknown, cookie = '') => fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', cookie }, body: JSON.stringify(body) });
  try {
    const a = await post('/register', { username: 'alice', password: 'test-password-only' });
    assert.equal(a.status, 200);
    assert.match(a.headers.get('set-cookie')!, /HttpOnly/i);
    const first = a.headers.get('set-cookie')!.split(';')[0];
    const b = await post('/register', { username: 'bob', password: 'test-password-only' });
    const second = b.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(origin + '/records')).status, 401);
    const csrf = await fetch(origin + '/records/x', { method: 'POST', headers: { 'content-type': 'application/json', cookie: first }, body: '{}' });
    assert.equal(csrf.status, 403);
    const data = { kind: 'watchlist', version: 0, data: { symbols: ['TCS'] } };
    assert.equal((await post('/records/x', data, first)).status, 200);
    assert.equal((await post('/records/x', data, first)).status, 409);
    assert.equal((await post('/records/x/delete', { version: 1 }, second)).status, 409);
    const other = await fetch(origin + '/export', { headers: { cookie: second } });
    assert.equal(other.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await other.json()).records, []);
    const rotated = await post('/change-password', { current: 'test-password-only', next: 'new-test-password-only' }, first);
    assert.equal(rotated.status, 200);
    assert.equal((await fetch(origin + '/records', { headers: { cookie: first } })).status, 401);
    const fresh = rotated.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await post('/delete-account', { password: 'new-test-password-only' }, fresh)).status, 200);
    assert.equal((await fetch(origin + '/records', { headers: { cookie: fresh } })).status, 401);
    assert.equal((await fetch(origin + '/records', { headers: { cookie: second } })).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
