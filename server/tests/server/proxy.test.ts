import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { proxyMiddleware } from '../../src/middleware/proxy.js';
import { createSpace } from '../../src/repos/space.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import api from '../../src/routes/api.js';

let fetchMock: ReturnType<typeof mock>;
let originalFetch: typeof globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', proxyMiddleware());
  app.route('/api', api);
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
    it('serves hub via fetch for excalihub.example.com', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'excalihub.example.com' },
      });
      const body = await res.text();
      expect(body).toBe('ok');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('returns 404 for bare example.com when HUB_SUBDOMAIN is set', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'example.com' },
      });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('bypasses hub serving for /api/* paths', async () => {
      const res = await makeApp().request('/api/test', {
        headers: { host: 'excalihub.example.com' },
      });
      const body = await res.json();
      expect(body.reached).toBe('next');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('hub routing without HUB_SUBDOMAIN', () => {
    const originalHubSubdomain = process.env.HUB_SUBDOMAIN;

    beforeEach(() => {
      process.env.HUB_SUBDOMAIN = '';
    });

    afterEach(() => {
      if (originalHubSubdomain === undefined) {
        delete process.env.HUB_SUBDOMAIN;
      } else {
        process.env.HUB_SUBDOMAIN = originalHubSubdomain;
      }
    });

    it('serves hub via fetch for bare example.com when no subdomain configured', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'example.com' },
      });
      const body = await res.text();
      expect(body).toBe('ok');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('serves hub via fetch for default BASE_DOMAIN when no subdomain configured', async () => {
      const res = await makeApp().request('/', {
        headers: { host: process.env.BASE_DOMAIN },
      });
      const body = await res.text();
      expect(body).toBe('ok');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('does not route unknown hosts to hub when no subdomain configured', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'random.other.com' },
      });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('subdomain routing', () => {
    it('bypasses Excalidraw proxy for /api/* paths under subdomain', async () => {
      createSpace('My Project', 'myproject');

      const res = await makeApp().request('/api/git/config', {
        headers: { host: 'myproject.excalihub.example.com' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('repoUrl');
      expect(body).toHaveProperty('connected', false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('proxies to Excalidraw when space exists', async () => {
      createSpace('My Project', 'myproject');

      const res = await makeApp().request('/boards/test-board', {
        headers: { host: 'myproject.excalihub.example.com' },
      });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [target, opts] = fetchMock.mock.calls[0];
      expect(target).toBe('http://localhost:8080/boards/test-board');
      expect(opts.method).toBe('GET');
    });

    it('returns 404 when space does not exist', async () => {
      const res = await makeApp().request('/', {
        headers: { host: 'nonexistent.excalihub.example.com' },
      });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rewrites host header for proxied requests', async () => {
      createSpace('Space', 'space');

      await makeApp().request('/', {
        headers: { host: 'space.excalihub.example.com' },
      });

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers.get('host')).toBe('localhost:8080');
    });

    it('forwards body for POST requests', async () => {
      createSpace('Space', 'space');

      await makeApp().request('/', {
        method: 'POST',
        headers: { host: 'space.excalihub.example.com' },
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
        headers: { host: 'space.excalihub.example.com' },
      });

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.body).toBeUndefined();
    });

    it('injects sync script into HTML responses', async () => {
      createSpace('Space', 'space');
      fetchMock = mock(() =>
        new Response('<html><body><h1>Hello</h1></body></html>', {
          headers: { 'content-type': 'text/html' },
        })
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const res = await makeApp().request('/', {
        headers: { host: 'space.excalihub.example.com' },
      });
      const body = await res.text();
      expect(body).toContain('excalihub-sync');
      expect(body).toContain('window.__SPACE_NAME = "Space"');
      expect(body).toContain('</body>');
    });

    it('injects menu CSS into HTML responses', async () => {
      createSpace('Space', 'space');
      fetchMock = mock(() =>
        new Response('<html><body></body></html>', {
          headers: { 'content-type': 'text/html' },
        })
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const res = await makeApp().request('/', {
        headers: { host: 'space.excalihub.example.com' },
      });
      const body = await res.text();
      expect(body).toContain('data-excalihub-menu');
      expect(body).toContain('<style');
      expect(body).toContain('#hub-commit-modal-overlay');
    });

    it('injects menu JS into HTML responses', async () => {
      createSpace('Space', 'space');
      fetchMock = mock(() =>
        new Response('<html><body></body></html>', {
          headers: { 'content-type': 'text/html' },
        })
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const res = await makeApp().request('/', {
        headers: { host: 'space.excalihub.example.com' },
      });
      const body = await res.text();
      expect(body).toContain('data-excalihub-menu');
      expect(body).toContain('<script');
      expect(body).toContain('hub-menu-container');
    });

    it('does not inject into non-HTML responses', async () => {
      createSpace('Space', 'space');
      fetchMock = mock(() =>
        new Response('{"status":"ok"}', {
          headers: { 'content-type': 'application/json' },
        })
      );
      globalThis.fetch = fetchMock as typeof globalThis.fetch;

      const res = await makeApp().request('/', {
        headers: { host: 'space.excalihub.example.com' },
      });
      const body = await res.text();
      expect(body).not.toContain('excalihub-sync');
      expect(body).not.toContain('excalihub-menu');
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
