import assert from 'node:assert/strict';
import test from 'node:test';
import type { IncomingHttpHeaders } from 'node:http';
import { normalizeVercelProxyHeaders } from '../proxyHeaders';
test('Vercel uses one validated edge IP and removes unsupported conflicting Forwarded chains', () => {
  const headers: IncomingHttpHeaders = {'x-vercel-forwarded-for':'2001:db8::1','x-forwarded-for':'spoofed, 1.2.3.4',forwarded:'for=attacker',authorization:'Bearer test'};
  normalizeVercelProxyHeaders(headers);
  assert.equal(headers['x-forwarded-for'],'2001:db8::1');assert.equal(headers.forwarded,undefined);assert.equal(headers.authorization,'Bearer test');
  for(const input of ['1.2.3.4, 5.6.7.8','unknown','1.2.3.4:123']) {
    const invalid: IncomingHttpHeaders={'x-forwarded-for':input,forwarded:'for=1.2.3.4'};
    normalizeVercelProxyHeaders(invalid);assert.equal(invalid['x-forwarded-for'],undefined);
  }
});
