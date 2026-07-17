import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { env } from '~/env.js';
import { proxyMiddleware, injectionMiddleware } from '~/server/middleware/index.js';
import { getDb } from '~/server/db.js';
import api from '~/server/routes/api.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());
  app.use('*', async (_c, next) => {
    await getDb();
    return next();
  });
  app.route('/api', api);

  if (env.NODE_ENV !== 'development') {
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
