import { createApp } from '~/app.js';
import { initRepos } from '~/repos/index.js';
import { env } from '~/env.js';
import { log } from '~/logger.js';

function main() {
  initRepos(env.DATA_DIR);
  log.success('Data directory initialized');

  const app = createApp();

  Bun.serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST });
  log.success(`ExcaliHub listening on http://${env.HOST}:${env.PORT}`);
}

main();
