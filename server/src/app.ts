import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { proxyMiddleware } from '~/middleware/index.js';
import api from '~/routes/api.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
  });
  app.use('*', proxyMiddleware());
  app.route('/api', api);
  app.get('/health', async (c) => {
    return c.json({ status: 'ok' });
  });

  return app;
}
