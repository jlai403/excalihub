import { Context, Next } from 'hono';
import { env } from '~/env.js';
import { getSpaceBySubdomain } from '~/repos/space.js';

export function proxyMiddleware() {
  const hubHost = `${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}`;

  return async (c: Context, next: Next) => {
    const host = c.req.header('host') || '';

    // Subdomain → proxy to Excalidraw
    const subdomain = extractSubdomain(host, hubHost);
    if (subdomain) return proxyToExcalidraw(c, subdomain);

    // Hub or bare domain → continue to API/dashboard
    if (host === hubHost || host === env.BASE_DOMAIN) {
      return next();
    }

    // Unknown host
    return c.json({ error: 'Not found' }, 404);
  };
}

function extractSubdomain(host: string, hubHost: string): string | null {
  const suffix = `.${hubHost}`;
  if (!host.endsWith(suffix)) return null;
  return host.slice(0, -suffix.length);
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
