import { Context, Next } from 'hono';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { env } from '../../env.js';

let injectedScript: string | null = null;

function getInjectedScript(): string {
  if (!injectedScript) {
    injectedScript = readFileSync(
      resolve(import.meta.dirname, '../../inject/excalidraw-sync.js'),
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await next();

    if (!response?.headers) {
      return response;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    const html = await response.text();
    const script = `<script data-excalihub-sync>${getInjectedScript()}</script>`;
    const injected = html.replace('</body>', `${script}</body>`) || html + script;

    return new Response(injected, {
      status: response.status,
      headers: response.headers,
    });
  };
}
