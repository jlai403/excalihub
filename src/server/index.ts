import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { getDb } from './db.js';
import { env } from '../env.js';
import { log } from '../logger.js';

async function main() {
  await getDb();
  log.success('Database initialized');

  const app = createApp();

  serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, () => {
    log.success(`ExcaliHub listening on http://${env.HOST}:${env.PORT}`);
  });
}

main().catch(log.error);
