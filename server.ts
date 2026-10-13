import { readConfig } from './server/config';
import { createApp, apiErrorHandler } from './server/app';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { liveStreamManager } from './server/market/liveStream';
import { logger } from './server/logger';
import { newsPush } from './server/push';
import { marketService } from './server/market';
import { startWorkspaceAlerts } from './server/workspace/worker';

const config = readConfig();
const production = process.argv.includes('--production') || config.NODE_ENV === 'production';
const app = createApp(config, production);
newsPush.start(() => marketService.news());
const stopWorkspaceAlerts = startWorkspaceAlerts();
const directory = path.dirname(fileURLToPath(import.meta.url));
let closeVite: (() => Promise<void>) | undefined;

if (production) {
  const clientDirectory = path.join(directory, 'client');
  app.use(express.static(clientDirectory, { index: false, maxAge: '1h', setHeaders: (res, file) => {
    if (file.endsWith('sw.js') || file.endsWith('manifest.webmanifest') || file.includes('icons')) res.setHeader('Cache-Control', 'no-cache');
  } }));
  app.get('*', (req, res) => {
    if (path.extname(req.path)) {
      res.status(404).send('Not found');
      return;
    }
    res.set('Cache-Control', 'no-cache').sendFile(path.join(clientDirectory, 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  closeVite = () => vite.close();
  app.use(vite.middlewares);
  app.get('*', async (req, res, next) => {
    try {
      const template = await readFile(path.join(directory, 'index.html'), 'utf8');
      res.type('html').send(await vite.transformIndexHtml(req.originalUrl, template));
    } catch (error) {
      next(error);
    }
  });
}

app.use(apiErrorHandler);

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(
    `Global Markets Command Center (${production ? 'production' : 'development'}) listening on http://${config.HOST}:${config.PORT}`
  );
});

server.requestTimeout = 40_000;
server.headersTimeout = 45_000;

server.on('error', (err) => {
  logger.error('Unable to start server. Check HOST, PORT and port availability.', err);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info(`Received ${signal}. Draining live connections and shutting down gracefully...`);
    liveStreamManager.stop();
    newsPush.stop();
    stopWorkspaceAlerts();
    server.close(() => {
      logger.info('HTTP server closed.');
      void closeVite?.().finally(() => process.exit(0));
      if (!closeVite) process.exit(0);
    });
    setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10_000).unref();
  });
}
