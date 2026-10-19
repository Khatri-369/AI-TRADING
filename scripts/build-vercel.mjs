import { cp, mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import console from 'node:console';
import esbuild from 'esbuild';

// 1. Prepare static frontend output
await mkdir('.vercel/output/static', { recursive: true });
await cp('dist/client', '.vercel/output/static', { recursive: true });

// 2. Handle API routes: either proxy to BACKEND_ORIGIN or build Serverless Function
const value = process.env.BACKEND_ORIGIN?.trim();
let backend = null;

if (value) {
  backend = new URL(value);
  if (
    backend.protocol !== 'https:' ||
    backend.username ||
    backend.password ||
    backend.pathname !== '/' ||
    backend.search ||
    backend.hash ||
    backend.hostname === 'localhost'
  ) {
    throw new Error('BACKEND_ORIGIN must be an HTTPS origin without credentials, path, query or fragment.');
  }
}

let apiRoute;
if (backend) {
  apiRoute = { src: '/api/(.*)', dest: `${backend.origin}/api/$1`, headers: { 'Cache-Control': 'no-store' } };
  console.log(`Configured API proxy to external BACKEND_ORIGIN: ${backend.origin}`);
} else {
  // Build Vercel Serverless Function for all /api routes
  const funcDir = '.vercel/output/functions/api.func';
  await mkdir(funcDir, { recursive: true });
  await writeFile(
    `${funcDir}/.vc-config.json`,
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        maxDuration: 60,
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        shouldAddHelpers: false,
        shouldAddSourcemapSupport: true,
      },
      null,
      2
    )
  );

  // Bundle serverless handler with esbuild into a self-contained bundle
  await esbuild.build({
    entryPoints: ['server/vercelHandler.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
    outfile: `${funcDir}/index.mjs`,
  });

  apiRoute = { src: '/api(?:/(.*))?', dest: '/api' };
  console.log('Built-in Vercel Serverless Function prepared for all /api endpoints.');
}

// 3. Write Vercel Build Output configuration
await writeFile(
  '.vercel/output/config.json',
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '/(.*)',
          headers: {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Content-Security-Policy':
              "default-src 'self'; script-src 'self' https://cdn.onesignal.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.onesignal.com; frame-src 'self' https://*.onesignal.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
          continue: true,
        },
        { src: '/sw.js', headers: { 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }, continue: true },
        { src: '/onesignal/OneSignalSDKWorker.js', headers: { 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/onesignal/' }, continue: true },
        { src: '/manifest.webmanifest', headers: { 'Cache-Control': 'no-cache' }, continue: true },
        { src: '/icons/.*', headers: { 'Cache-Control': 'no-cache' }, continue: true },
        apiRoute,
        { handle: 'filesystem' },
        { src: '/assets/.*', status: 404 },
        { src: '/.*', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
      ],
    },
    null,
    2
  )
);
console.log('Vercel Build Output API v3 bundle ready.');
