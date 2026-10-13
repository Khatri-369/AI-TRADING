import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { readConfig } from './config';
import { createApp } from './app';

let appInstance: Express | null = null;

function getApp(): Express {
  if (!appInstance) {
    if (!process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET = 'vercel-serverless-session-secret-salt-32chars';
    }
    const config = readConfig({
      ...process.env,
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '3000',
    });
    appInstance = createApp(config, true);
  }
  return appInstance;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
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
}
