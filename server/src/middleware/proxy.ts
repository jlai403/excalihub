import { Context, Next } from 'hono';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { env } from '~/env.js';
import { getSpaceBySubdomain } from '~/repos/space.js';

export function proxyMiddleware() {
  const hubHost = `${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}`;

  return async (c: Context, next: Next) => {
    const rawHost = c.req.header('host') || '';
    const host = rawHost.replace(/:\d+$/, '');

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
    const res = await fetch(`http://localhost:${env.HUB_PORT}${url.pathname}${url.search}`);
    return new Response(res.body, { status: res.status, headers: res.headers });
  }

  const filePath = `./dist/public${url.pathname === '/' ? '/index.html' : url.pathname}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { 'Content-Type': file.type },
    });
  }
  return next();
}

let injectedScript: string | null = null;
let injectedBubbleCss: string | null = null;
let injectedBubbleScript: string | null = null;

function getInjectedScript(): string {
  if (!injectedScript) {
    injectedScript = readFileSync(
      resolve(import.meta.dirname, '../inject/excalidraw-sync.js'),
      'utf-8'
    );
  }
  return injectedScript;
}

function getInjectedBubbleCss(): string {
  if (!injectedBubbleCss) {
    injectedBubbleCss = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-bubble.css'),
      'utf-8'
    );
  }
  return injectedBubbleCss;
}

function getInjectedBubbleScript(): string {
  if (!injectedBubbleScript) {
    injectedBubbleScript = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-bubble.js'),
      'utf-8'
    );
  }
  return injectedBubbleScript;
}

async function proxyToExcalidraw(c: Context, subdomain: string) {
  if (!getSpaceBySubdomain(subdomain)) {
    return c.json({ error: 'Space not found' }, 404);
  }

  const url = new URL(c.req.url);
  const target = `${env.EXCALIDRAW_CONTAINER}${url.pathname}${url.search}`;

  const headers = new Headers(c.req.raw.headers);
  headers.set('host', new URL(env.EXCALIDRAW_CONTAINER).host);

  const res = await fetch(target, {
    method: c.req.method,
    headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD'
      ? c.req.raw.body
      : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;

  const html = await res.text();
  const debugFlag = env.NODE_ENV !== 'production' ? 'window.__EXCALIHUB_DEBUG = true;' : '';
  const bubbleCss = `<style data-excalihub-bubble>${getInjectedBubbleCss()}</style>`;
  const bubbleScript = `<script data-excalihub-bubble>${getInjectedBubbleScript()}</script>`;
  const syncScript = `<script data-excalihub-sync>${debugFlag}${getInjectedScript()}</script>`;
  const injection = `${bubbleCss}${bubbleScript}${syncScript}`;
  const injected = html.includes('</body>')
    ? html.replace('</body>', `${injection}</body>`)
    : html + injection;

  return new Response(injected, {
    status: res.status,
    headers: res.headers,
  });
}
