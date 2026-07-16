import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

let app: Hono;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
  vi.stubGlobal('fetch', fetchMock);

  process.env.BASE_DOMAIN = 'draw.domain.com';
  process.env.EXCALIDRAW_CONTAINER = 'http://localhost:8080';

  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.BASE_DOMAIN;
  delete process.env.EXCALIDRAW_CONTAINER;
});

async function importProxy() {
  const mod = await import('../../src/server/proxy.js');
  return mod.proxyMiddleware();
}

describe('proxyMiddleware', () => {
  it('passes through for base domain host', async () => {
    const nextCalled = { current: false };
    const middleware = await importProxy();

    const app = new Hono();
    app.use('*', middleware);
    app.get('*', (c) => {
      nextCalled.current = true;
      return c.json({ passed: true });
    });

    const res = await app.request('/', {
      headers: { host: 'draw.domain.com' },
    });
    expect(res.status).toBe(200);
    expect(nextCalled.current).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through for localhost', async () => {
    const nextCalled = { current: false };
    const middleware = await importProxy();

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

  it('proxies subdomain requests to Excalidraw container', async () => {
    const middleware = await importProxy();

    const app = new Hono();
    app.use('*', middleware);

    const res = await app.request('/boards/test-board', {
      headers: { host: 'myproject.draw.domain.com' },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [target, opts] = fetchMock.mock.calls[0];
    expect(target).toBe('http://localhost:8080/boards/test-board');
    expect(opts.method).toBe('GET');
  });

  it('rewrites host header for proxied requests', async () => {
    const middleware = await importProxy();

    const app = new Hono();
    app.use('*', middleware);

    await app.request('/', {
      headers: { host: 'space.draw.domain.com' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.get('host')).toBe('localhost:8080');
  });

  it('forwards body for POST requests', async () => {
    const middleware = await importProxy();

    const app = new Hono();
    app.use('*', middleware);

    await app.request('/', {
      method: 'POST',
      headers: { host: 'space.draw.domain.com' },
      body: '{"test":true}',
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeDefined();
    expect(opts.body).toBeInstanceOf(ReadableStream);
  });

  it('does not forward body for GET requests', async () => {
    const middleware = await importProxy();

    const app = new Hono();
    app.use('*', middleware);

    await app.request('/', {
      method: 'GET',
      headers: { host: 'space.draw.domain.com' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });
});
