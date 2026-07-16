import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { getDb } from './db.js';
import { proxyMiddleware } from './proxy.js';
import { injectionMiddleware } from './inject.js';
import api from './routes/api.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// API routes (must come before proxy)
app.route('/', api);

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
const port = parseInt(process.env.PORT || '80');
const host = process.env.HOST || '0.0.0.0';

async function main() {
  await getDb();
  console.log('Database initialized');
  
  console.log(`ExcaliHub starting on ${host}:${port}`);
  console.log(`Base domain: ${process.env.BASE_DOMAIN || 'draw.domain.com'}`);
  console.log(`Excalidraw container: ${process.env.EXCALIDRAW_CONTAINER || 'http://localhost:8080'}`);
}

main().catch(console.error);

export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
