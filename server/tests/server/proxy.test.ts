import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { proxyMiddleware } from '../../src/middleware/proxy.js';
import { createSpace } from '../../src/repos/space.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';

let fetchMock: ReturnType<typeof mock>;
let originalFetch: typeof globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', proxyMiddleware());
  app.get('/*', (c) => c.json({ reached: 'next' }));
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
  describe('hub routing', () => {
    it('calls next() for draw.example.com', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'draw.example.com' },
      });
      const body = await res.json();
      expect(body.reached).toBe('next');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('calls next() for bare example.com', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'example.com' },
      });
      const body = await res.json();
      expect(body.reached).toBe('next');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('subdomain routing', () => {
    it('proxies to Excalidraw when space exists', async () => {
      createSpace('My Project', 'myproject');

      const res = await makeApp().request('/boards/test-board', {
        headers: { host: 'myproject.draw.example.com' },
      });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [target, opts] = fetchMock.mock.calls[0];
      expect(target).toBe('http://localhost:8080/boards/test-board');
      expect(opts.method).toBe('GET');
    });

    it('returns 404 when space does not exist', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'nonexistent.draw.example.com' },
      });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
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

  describe('non-matching hosts', () => {
    it('returns 404 for unknown domains', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'random.other.com' },
      });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 404 for localhost', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'localhost' },
      });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
