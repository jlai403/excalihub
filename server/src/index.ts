import { createApp } from '~/app.js';
import { initRepos } from '~/repos/index.js';
import { env } from '~/env.js';
import { log } from '~/logger.js';

function main() {
  initRepos(env.DATA_DIR);
  log.success('Data directory initialized');

  const app = createApp();

  // Cap request bodies so a single unauthenticated request can't exhaust memory.
  // Excalidraw uploads are capped at 4 MiB per image; 64 MiB leaves headroom for
  // multi-image scenes while still bounding the worst case.
  Bun.serve({
    fetch: app.fetch,
    port: env.PORT,
    hostname: env.HOST,
    maxRequestBodySize: 64 * 1024 * 1024,
  });
  log.success(`ExcaliHub listening on http://${env.HOST}:${env.PORT}`);
}

main();
