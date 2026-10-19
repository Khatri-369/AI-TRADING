import { isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

/** Only called at the Vercel entrypoint. Vercel overwrites these IP headers at its edge. */
export function normalizeVercelProxyHeaders(headers: IncomingHttpHeaders) {
  const ip = headers['x-vercel-forwarded-for'] ?? headers['x-forwarded-for'];
  if (typeof ip === 'string' && isIP(ip.trim())) headers['x-forwarded-for'] = ip.trim();
  else delete headers['x-forwarded-for'];
  // Express uses X-Forwarded-For, not RFC 7239 Forwarded; never trust two conflicting chains.
  delete headers.forwarded;
}
