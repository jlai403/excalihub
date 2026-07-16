import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { getDb } from './db.js';
import { proxyMiddleware } from './proxy.js';
import { injectionMiddleware } from './inject.js';
import api from './routes/api.js';
import { env } from '../env.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// API routes
app.route('/api', api);

// Serve static files from Astro build
app.use('/*', serveStatic({ root: './dist/public' }));

// Proxy to Excalidraw for space routes
app.use('*', proxyMiddleware());

// Inject sync script into HTML responses
app.use('*', injectionMiddleware());

// Health check
app.get('/health', async (c) => {
  await getDb();
  return c.json({ status: 'ok' });
});

// Start server
const port = env.PORT;
const host = env.HOST;

async function main() {
  await getDb();
  console.log('Database initialized');
  
  console.log(`ExcaliHub starting on ${env.HOST}:${env.PORT}`);
  console.log(`Base domain: ${env.BASE_DOMAIN}`);
  console.log(`Excalidraw container: ${env.EXCALIDRAW_CONTAINER}`);
}

main().catch(console.error);

export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
