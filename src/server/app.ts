import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { getDb } from './db.js';
import { proxyMiddleware } from './proxy.js';
import { injectionMiddleware } from './inject.js';
import api from './routes/api.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());
  app.route('/api', api);

  if (existsSync('./dist/public')) {
    app.use('/*', serveStatic({ root: './dist/public' }));
  }

  app.use('*', proxyMiddleware());
  app.use('*', injectionMiddleware());
  app.get('/health', async (c) => {
    await getDb();
    return c.json({ status: 'ok' });
  });

  return app;
}
