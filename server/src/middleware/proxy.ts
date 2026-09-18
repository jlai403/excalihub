import { Context, Next } from 'hono';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { env, envSchema } from '~/env.js';
import { getSpaceBySubdomain } from '~/repos/space.js';
import { getBackupById } from '~/repos/backup.js';
import { getGitConfig } from '~/repos/git.js';

function hubHostFor(e: { HUB_SUBDOMAIN: string; BASE_DOMAIN: string }): string {
  return e.HUB_SUBDOMAIN ? `${e.HUB_SUBDOMAIN}.${e.BASE_DOMAIN}` : '';
}

const RESERVED_BACKUP_SUBDOMAIN = 'backup';

// JSON.stringify doesn't escape `<`, which lets a `</script>` in a value close
// an inline script element early (stored XSS). Also neutralises U+2028/2029,
// which are legal in JSON string literals but not JS string literals.
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function proxyMiddleware() {
  return async (c: Context, next: Next) => {
    const e = envSchema.parse(process.env);
    const rawHost = c.req.header('host') || '';
    const host = rawHost.replace(/:\d+$/, '');
    const url = new URL(c.req.url);
    const hubHost = hubHostFor(e);

    // API routes are host-independent — serve them regardless of which
    // subdomain/apex the request arrived on.
    if (url.pathname.startsWith('/api/')) return next();

    const subdomain = extractSubdomain(host, hubHost);
    if (subdomain) {
      if (subdomain === RESERVED_BACKUP_SUBDOMAIN) {
        return serveBackupPreview(c);
      }
      return proxyToExcalidraw(c, subdomain);
    }

    if (host === hubHost || (!e.HUB_SUBDOMAIN && host === e.BASE_DOMAIN)) {
      return serveHub(c, next);
    }

    return c.json({ error: 'Not found' }, 404);
  };
}

function extractSubdomain(host: string, hubHost: string): string | null {
  if (!hubHost) return null;
  const suffix = `.${hubHost}`;
  if (!host.endsWith(suffix)) return null;
  return host.slice(0, -suffix.length);
}

async function serveHub(c: Context, next: Next) {
  const e = envSchema.parse(process.env);
  const url = new URL(c.req.url);

  if (url.pathname.startsWith('/api/')) {
    return next();
  }

  if (e.NODE_ENV !== 'production') {
    const res = await fetch(`http://localhost:${e.HUB_PORT}${url.pathname}${url.search}`);
    return new Response(res.body, { status: res.status, headers: res.headers });
  }

  const filePath = `./dist/public${url.pathname === '/' ? '/index.html' : url.pathname}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { 'Content-Type': file.type },
    });
  }

  const indexPath = `./dist/public${url.pathname}/index.html`;
  const indexFile = Bun.file(indexPath);
  if (await indexFile.exists()) {
    return new Response(indexFile, {
      headers: { 'Content-Type': indexFile.type },
    });
  }
  return next();
}

let injectedScript: string | null = null;
let injectedMenuCss: string | null = null;
let injectedMenuScript: string | null = null;
let injectedCommitModalScript: string | null = null;
let injectedPaletteCss: string | null = null;
let injectedPaletteScript: string | null = null;
let injectedBackupsCss: string | null = null;
let injectedBackupsScript: string | null = null;
let injectedBackupPreviewCss: string | null = null;
let injectedBackupPreviewScript: string | null = null;

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

function getInjectedPaletteCss(): string {
  if (!injectedPaletteCss) {
    injectedPaletteCss = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-palette.css'),
      'utf-8'
    );
  }
  return injectedPaletteCss;
}

function getInjectedPaletteScript(): string {
  if (!injectedPaletteScript) {
    injectedPaletteScript = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-palette.js'),
      'utf-8'
    );
  }
  return injectedPaletteScript;
}

function getBackupsCss(): string {
  if (!injectedBackupsCss) {
    injectedBackupsCss = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-backups.css'),
      'utf-8'
    );
  }
  return injectedBackupsCss;
}

function getBackupsScript(): string {
  if (!injectedBackupsScript) {
    injectedBackupsScript = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-backups.js'),
      'utf-8'
    );
  }
  return injectedBackupsScript;
}

function getBackupPreviewCss(): string {
  if (!injectedBackupPreviewCss) {
    injectedBackupPreviewCss = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-backup-preview.css'),
      'utf-8'
    );
  }
  return injectedBackupPreviewCss;
}

function getBackupPreviewScript(): string {
  if (!injectedBackupPreviewScript) {
    injectedBackupPreviewScript = readFileSync(
      resolve(import.meta.dirname, '../inject/hub-backup-preview.js'),
      'utf-8'
    );
  }
  return injectedBackupPreviewScript;
}

function noopServiceWorker(url: URL): Response | null {
  if (url.pathname !== '/sw.js' && url.pathname !== '/sw.js.map') return null;
  return new Response(
    url.pathname === '/sw.js.map'
      ? ''
      : `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',()=>self.clients.claim());`,
    {
      headers: {
        'Content-Type': url.pathname.endsWith('.map') ? 'application/json' : 'application/javascript',
        'Cache-Control': 'no-store',
      },
    }
  );
}

async function proxyToExcalidraw(c: Context, subdomain: string) {
  const space = getSpaceBySubdomain(subdomain);
  if (!space) {
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

  const noopSw = noopServiceWorker(url);
  if (noopSw) return noopSw;

  const res = await fetchContainer(c, url);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;

  const html = await res.text();
  const debugFlag = env.NODE_ENV !== 'production' ? 'window.__EXCALIHUB_DEBUG = true;' : '';
  const gitConfig = getGitConfig();
  const gitEnabled = gitConfig?.connected ? 'true' : 'false';
  const menuCss = `<style data-excalihub-menu>${getInjectedMenuCss()}</style>`;
  const menuScript = `<script data-excalihub-menu>window.__GIT_ENABLED = '${gitEnabled}';window.__hubHost = ${embedJson(hubHostFor(envSchema.parse(process.env)))};${getInjectedMenuScript()}</script>`;
  const commitModalScript = `<script data-excalihub-commit-modal>${getInjectedCommitModalScript()}</script>`;
  const paletteCss = `<style data-excalihub-palette>${getInjectedPaletteCss()}</style>`;
  const paletteScript = `<script data-excalihub-palette>${getInjectedPaletteScript()}</script>`;
  const backupsCss = `<style data-excalihub-backups>${getBackupsCss()}</style>`;
  const backupsScript = `<script data-excalihub-backups>${getBackupsScript()}</script>`;

  const syncScript = `<script data-excalihub-sync>${debugFlag}window.__SPACE_NAME = ${embedJson(space.name)};window.__SPACE_ID = ${embedJson(space.id)};${getInjectedScript()}</script>`;
  const injection = `${menuCss}${menuScript}${commitModalScript}${paletteCss}${paletteScript}${backupsCss}${backupsScript}${syncScript}`;

  return injectIntoHtml(res, html, injection);
}

async function serveBackupPreview(c: Context) {
  const url = new URL(c.req.url);

  const noopSw = noopServiceWorker(url);
  if (noopSw) return noopSw;

  const spaceSubdomain = url.searchParams.get('space');
  const filename = url.searchParams.get('backup');

  if (spaceSubdomain || filename) {
    const space = getSpaceBySubdomain(spaceSubdomain ?? '');
    if (!space) return c.json({ error: 'Space not found' }, 404);
    const backup = filename ? getBackupById(filename) : null;
    if (!backup || backup.subdomain !== spaceSubdomain) {
      return c.json({ error: 'Backup not found' }, 404);
    }
  }

  const res = await fetchContainer(c, url);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;
  if (!spaceSubdomain || !filename) return res;

  const html = await res.text();
  const hubHost = hubHostFor(envSchema.parse(process.env));
  const previewConfig = {
    space: spaceSubdomain,
    filename,
    hubHost,
  };
  const injection =
    `<style data-excalihub-backup-preview>${getBackupPreviewCss()}</style>` +
    `<script data-excalihub-backup-preview>window.__BACKUP_PREVIEW = ${embedJson(previewConfig)};${getBackupPreviewScript()}</script>` +
    `<style data-excalihub-palette>${getInjectedPaletteCss()}</style>` +
    `<script data-excalihub-palette>window.__hubHost = ${embedJson(hubHost)};window.__PALETTE_MINIMAL = 'true';${getInjectedPaletteScript()}</script>`;

  return injectIntoHtml(res, html, injection);
}

async function fetchContainer(c: Context, url: URL): Promise<Response> {
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

function injectIntoHtml(res: Response, html: string, injection: string): Response {
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
