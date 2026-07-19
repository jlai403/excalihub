import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { env } from '~/env.js';
import {
  proxyMiddleware,
  injectionMiddleware,
} from '~/middleware/index.js';
import api from '~/routes/api.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());
  app.route('/api', api);

  if (env.NODE_ENV !== 'development') {
    app.use('/*', serveStatic({ root: './dist/public' }));
  }

  app.use('*', proxyMiddleware());
  app.use('*', injectionMiddleware());
  app.get('/health', async (c) => {
    return c.json({ status: 'ok' });
  });

  return app;
}
