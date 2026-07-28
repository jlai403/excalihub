import { Context, Next } from 'hono';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { env } from '~/env.js';
import { getSpaceBySubdomain } from '~/repos/space.js';
import { getGitConfig } from '~/repos/git.js';

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
let injectedMenuCss: string | null = null;
let injectedMenuScript: string | null = null;
let injectedCommitModalScript: string | null = null;

function getInjectedScript(): string {
  if (!injectedScript) {
    injectedScript = readFileSync(
      resolve(import.meta.dirname, '../inject/excalidraw-sync.js'),
      'utf-8'
    );
  }
  return injectedScript;
}

function getInjectedMenuCss(): string {
  if (!injectedMenuCss) {
    injectedMenuCss = readFileSync(
      resolve(import.meta.dirname, '../inject/commit-modal.css'),
      'utf-8'
    );
  }
  return injectedMenuCss;
}

function getInjectedMenuScript(): string {
  if (!injectedMenuScript) {
    injectedMenuScript = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-menu.js'),
      'utf-8'
    );
  }
  return injectedMenuScript;
}

function getInjectedCommitModalScript(): string {
  if (!injectedCommitModalScript) {
    injectedCommitModalScript = readFileSync(
      resolve(import.meta.dirname, '../inject/commit-modal.js'),
      'utf-8'
    );
  }
  return injectedCommitModalScript;
}

async function proxyToExcalidraw(c: Context, subdomain: string) {
  if (!getSpaceBySubdomain(subdomain)) {
    return c.json({ error: 'Space not found' }, 404);
  }

  const url = new URL(c.req.url);

  if (url.pathname === '/excalihub-icon.png') {
    const iconPath = resolve(import.meta.dirname, '../inject/excalihub-icon.png');
    const file = Bun.file(iconPath);
    if (await file.exists()) {
      return new Response(file, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
      });
    }
  }

  if (url.pathname === '/sw.js' || url.pathname === '/sw.js.map') {
    return new Response(
      url.pathname === '/sw.js.map'
        ? ''
        : `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',()=>self.clients.claim());`,
      { headers: { 'Content-Type': url.pathname.endsWith('.map') ? 'application/json' : 'application/javascript', 'Cache-Control': 'no-store' } }
    );
  }

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
  const gitConfig = getGitConfig();
  const gitEnabled = gitConfig?.connected ? 'true' : 'false';
  const menuCss = `<style data-excalihub-menu>${getInjectedMenuCss()}</style>`;
  const menuScript = `<script data-excalihub-menu>window.__GIT_ENABLED = '${gitEnabled}';${getInjectedMenuScript()}</script>`;
  const commitModalScript = `<script data-excalihub-commit-modal>${getInjectedCommitModalScript()}</script>`;

  const syncScript = `<script data-excalihub-sync>${debugFlag}${getInjectedScript()}</script>`;
  const injection = `${menuCss}${menuScript}${commitModalScript}${syncScript}`;
  const injected = html.includes('</body>')
    ? html.replace('</body>', `${injection}</body>`)
    : html + injection;

  const resHeaders = new Headers(res.headers);
  resHeaders.set('Cache-Control', 'no-store');

  return new Response(injected, {
    status: res.status,
    headers: resHeaders,
  });
}
