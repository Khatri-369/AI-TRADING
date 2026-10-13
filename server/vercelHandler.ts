import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { readConfig } from './config';
import { createApp } from './app';

let appInstance: Express | null = null;
let initError: Error | null = null;

function getApp(): Express {
  if (initError) throw initError;
  if (!appInstance) {
    try {
      const config = readConfig({
        ...process.env,
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000',
      });
      appInstance = createApp(config, true);
    } catch (err) {
      initError = err instanceof Error ? err : new Error(String(err));
      throw initError;
    }
  }
  return appInstance;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // If Vercel rewrote the URL to /api, restore the original requested path
    const matchedPath = req.headers['x-matched-path'];
    if (typeof matchedPath === 'string' && matchedPath.startsWith('/api')) {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      req.url = `${matchedPath}${urlObj.search}`;
    }

    // Defensively guard removeHeader if called on serverless response objects
    if (res && typeof res.removeHeader === 'function') {
      const origRemove = res.removeHeader.bind(res);
      res.removeHeader = function (name: string) {
        try {
          origRemove(name);
        } catch {
          // Defensive no-op for uninitialized outgoing headers
        }
        return this;
      };
    }

    const app = getApp();
    return app(req, res);
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Serverless initialization failed',
          message: 'Check the backend environment configuration, including SESSION_SECRET.',
        })
      );
    }
  }
}
