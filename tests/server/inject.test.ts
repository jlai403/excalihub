import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { injectionMiddleware } from '../../src/server/middleware/auto-backup-inject.js';

let app: Hono;

beforeEach(() => {
  const middleware = injectionMiddleware();
  app = new Hono();
  app.use('*', middleware);
});

const HTML_RESPONSE = '<html><body><h1>Hello</h1></body></html>';

describe('injectionMiddleware', () => {
  it('passes through for non-subdomain host', async () => {
    app.get('/', (c) => c.html(HTML_RESPONSE));

    const res = await app.request('/', {
      headers: { host: 'draw.domain.com' },
    });
    const body = await res.text();
    expect(body).toBe(HTML_RESPONSE);
    expect(body).not.toContain('excalihub-sync');
  });

  it('passes through for localhost', async () => {
    app.get('/', (c) => c.html(HTML_RESPONSE));

    const res = await app.request('/', {
      headers: { host: 'localhost' },
    });
    const body = await res.text();
    expect(body).not.toContain('excalihub-sync');
  });

  // The injection middleware now properly injects the sync script into
  // HTML responses from subdomain hosts.
  it('injects into HTML for subdomain hosts', async () => {
    app.get('/', (c) => c.html(HTML_RESPONSE));

    const res = await app.request('/', {
      headers: { host: 'myproject.draw.domain.com' },
    });
    const body = await res.text();
    expect(body).toContain('excalihub-sync');
    expect(body).toContain('</body>');
  });

  it('does not inject into non-HTML responses', async () => {
    app.get('/', (c) => c.text('{"status":"ok"}'));

    const res = await app.request('/', {
      headers: { host: 'space.draw.domain.com' },
    });
    const body = await res.text();
    expect(body).not.toContain('excalihub-sync');
  });

  it('passes through when no closing body tag', async () => {
    app.get('/', (c) => c.body('<html><h1>No body tag</h1></html>', 200, {
      'content-type': 'text/html',
    }));

    const res = await app.request('/', {
      headers: { host: 'space.draw.domain.com' },
    });
    const body = await res.text();
    expect(body).not.toContain('excalihub-sync');
  });
});
