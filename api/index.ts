import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { readConfig } from '../server/config';
import { createApp, apiErrorHandler } from '../server/app';

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
    const app = createApp(config, true);
    app.use(apiErrorHandler);
    appInstance = app;
  }
  return appInstance;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const app = getApp();
  return app(req, res);
}
