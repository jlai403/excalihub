import { Context, Next } from 'hono';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { env } from '~/env.js';

let injectedScript: string | null = null;

function getInjectedScript(): string {
  if (!injectedScript) {
    injectedScript = readFileSync(
      resolve(import.meta.dirname, '../inject/excalidraw-sync.js'),
      'utf-8'
    );
  }
  return injectedScript;
}

export function injectionMiddleware() {
  return async (c: Context, next: Next) => {
    const host = c.req.header('host') || '';

    if (!host.endsWith(`.${env.BASE_DOMAIN}`)) {
      return next();
    }

    await next();

    if (!c.res?.headers) {
      return;
    }

    const contentType = c.res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return;
    }

    const html = await c.res.text();
    const script = `<script data-excalihub-sync>${getInjectedScript()}</script>`;
    const injected = html.replace('</body>', `${script}</body>`) || html + script;

    c.res = new Response(injected, {
      status: c.res.status,
      headers: c.res.headers,
    });
  };
}
