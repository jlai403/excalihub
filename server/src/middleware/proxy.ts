import { Context, Next } from 'hono';
import { env } from '~/env.js';
import { getSpaceBySubdomain } from '~/repos/space.js';

export function proxyMiddleware() {
  const hubHost = `${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}`;

  return async (c: Context, next: Next) => {
    const host = c.req.header('host') || '';

    const subdomain = extractSubdomain(host, hubHost);
    if (subdomain) return proxyToExcalidraw(c, subdomain);

    if (host === hubHost || host === env.BASE_DOMAIN) {
      return serveHub(c, next);
    }

    return c.json({ error: 'Not found' }, 404);
  };
}

function extractSubdomain(host: string, hubHost: string): string | null {
  const suffix = `.${hubHost}`;
  if (!host.endsWith(suffix)) return null;
  return host.slice(0, -suffix.length);
}

async function serveHub(c: Context, next: Next) {
  const url = new URL(c.req.url);

  if (url.pathname.startsWith('/api/')) {
    return next();
  }

  if (env.NODE_ENV !== 'production') {
    const res = await fetch(`http://localhost:4321${url.pathname}${url.search}`);
    return new Response(res.body, { status: res.status, headers: res.headers });
  }

  const filePath = `./dist/public${url.pathname === '/' ? '/index.html' : url.pathname}`;
  const file = Bun.file(filePath);
  if (await file.exists()) return new Response(file);
  return next();
}

async function proxyToExcalidraw(c: Context, subdomain: string) {
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
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD'
      ? c.req.raw.body
      : undefined,
  });
}
