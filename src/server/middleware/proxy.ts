import { Context, Next } from 'hono';
import { env } from '~/env.js';

export function proxyMiddleware() {
  return async (c: Context, next: Next) => {
    const host = c.req.header('host') || '';

    if (host === env.BASE_DOMAIN || host === `localhost:${env.PORT}`) {
      return next();
    }

    if (host.endsWith(`.${env.BASE_DOMAIN}`)) {
      const url = new URL(c.req.url);
      const target = `${env.EXCALIDRAW_CONTAINER}${url.pathname}${url.search}`;

      const headers = new Headers(c.req.raw.headers);
      headers.set('host', new URL(env.EXCALIDRAW_CONTAINER).host);

      return fetch(target, {
        method: c.req.method,
        headers,
        body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
      });
    }

    return next();
  };
}
