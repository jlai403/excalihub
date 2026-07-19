import { Context, Next } from 'hono';
import { env } from '~/env.js';
import { getSpaceBySubdomain } from '~/repos/space.js';

export function proxyMiddleware() {
  return async (c: Context, next: Next) => {
    const host = c.req.header('host') || '';
    const suffix = `.${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}`;
    const hubHost = `${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}`;

    // Hub domain → serve hub
    if (host === hubHost) {
      if (env.NODE_ENV === 'development') {
        const url = new URL(c.req.url);
        const res = await fetch(`http://localhost:4321${url.pathname}${url.search}`);
        return new Response(res.body, { status: res.status, headers: res.headers });
      }
      const url = new URL(c.req.url);
      const filePath = `./dist/public${url.pathname === '/' ? '/index.html' : url.pathname}`;
      const file = Bun.file(filePath);
      if (await file.exists()) return new Response(file);
      return next();
    }

    // Subdomain → Excalidraw
    if (!host.endsWith(suffix)) return next();

    const subdomain = host.slice(0, -suffix.length);

    if (!getSpaceBySubdomain(subdomain)) {
      return c.json({ error: 'Space not found' }, 404);
    }

    const url = new URL(c.req.url);
    const target = `${env.EXCALIDRAW_CONTAINER}${url.pathname}${url.search}`;

    const headers = new Headers(c.req.raw.headers);
    headers.set('host', new URL(env.EXCALIDRAW_CONTAINER).host);

    return fetch(target, {
      method: c.req.method,
      headers,
      body:
        c.req.method !== 'GET' && c.req.method !== 'HEAD'
          ? c.req.raw.body
          : undefined,
    });
  };
}
