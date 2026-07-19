import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { proxyMiddleware } from '../../src/server/middleware/proxy.js';
import { createSpace } from '../../src/server/repos/space.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';

let app: Hono;
let fetchMock: ReturnType<typeof mock>;
let originalFetch: typeof globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', proxyMiddleware());
  return app;
}

beforeEach(() => {
  setupTestDb();
  originalFetch = globalThis.fetch;
  fetchMock = mock(() => new Response('ok'));
  globalThis.fetch = fetchMock as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanupTestDb();
});

describe('proxyMiddleware', () => {
  it('passes through for base domain host', async () => {
    const nextCalled = { current: false };
    const middleware = proxyMiddleware();

    const app = new Hono();
    app.use('*', middleware);
    app.get('*', (c) => {
      nextCalled.current = true;
      return c.json({ passed: true });
    });

    const res = await app.request('/', {
      headers: { host: 'draw.example.com' },
    });
    expect(res.status).toBe(200);
    expect(nextCalled.current).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through for localhost', async () => {
    const nextCalled = { current: false };
    const middleware = proxyMiddleware();

    const app = new Hono();
    app.use('*', middleware);
    app.get('*', (c) => {
      nextCalled.current = true;
      return c.json({ passed: true });
    });

    const res = await app.request('/', {
      headers: { host: 'localhost' },
    });
    expect(res.status).toBe(200);
    expect(nextCalled.current).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown subdomains', async () => {
    const res = await makeApp().request('/boards/test-board', {
      headers: { host: 'unknown.draw.example.com' },
    });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies subdomain requests to Excalidraw container when space exists', async () => {
    createSpace('My Project', 'myproject');

    const res = await makeApp().request('/boards/test-board', {
      headers: { host: 'myproject.draw.example.com' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [target, opts] = fetchMock.mock.calls[0];
    expect(target).toBe('http://localhost:8080/boards/test-board');
    expect(opts.method).toBe('GET');
  });

  it('rewrites host header for proxied requests', async () => {
    createSpace('Space', 'space');

    await makeApp().request('/', {
      headers: { host: 'space.draw.example.com' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.get('host')).toBe('localhost:8080');
  });

  it('forwards body for POST requests', async () => {
    createSpace('Space', 'space');

    await makeApp().request('/', {
      method: 'POST',
      headers: { host: 'space.draw.example.com' },
      body: '{"test":true}',
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeDefined();
    expect(opts.body).toBeInstanceOf(ReadableStream);
  });

  it('does not forward body for GET requests', async () => {
    createSpace('Space', 'space');

    await makeApp().request('/', {
      method: 'GET',
      headers: { host: 'space.draw.example.com' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });
});
