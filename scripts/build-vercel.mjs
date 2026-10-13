import { cp, mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import console from 'node:console';

// BACKEND_ORIGIN is an operator-controlled HTTPS origin, never a provider key.
const value = process.env.BACKEND_ORIGIN;
if (!value) throw new Error('Set BACKEND_ORIGIN to the public HTTPS origin of your always-on Express backend before deploying to Vercel.');
const backend = new URL(value);
if (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash || backend.hostname === 'localhost') {
  throw new Error('BACKEND_ORIGIN must be an HTTPS origin without credentials, path, query or fragment.');
}
await mkdir('.vercel/output/static', { recursive: true });
await cp('dist/client', '.vercel/output/static', { recursive: true });
await writeFile('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [
    { src: '/(.*)', headers: { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" }, continue: true },
    { src: '/sw.js', headers: { 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }, continue: true },
    { src: '/api/(.*)', dest: `${backend.origin}/api/$1`, headers: { 'Cache-Control': 'no-store' } },
    { handle: 'filesystem' },
    { src: '/assets/.*', status: 404 },
    { src: '/.*', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
  ],
}, null, 2));
console.log('Vercel static output prepared with same-origin API forwarding.');
