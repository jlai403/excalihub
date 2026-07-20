import type { Hono } from 'hono';
import { env } from '../../src/env.js';

const HUB_HOST = `${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}`;

export function createApiHelper(app: Hono) {
  const hubHeaders = { host: HUB_HOST };

  return {
    get: (path: string) =>
      app.request(path, { headers: hubHeaders }),

    post: (path: string, body: unknown) =>
      app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...hubHeaders },
        body: JSON.stringify(body),
      }),

    put: (path: string, body: unknown) =>
      app.request(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...hubHeaders },
        body: JSON.stringify(body),
      }),

    patch: (path: string, body: unknown) =>
      app.request(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...hubHeaders },
        body: JSON.stringify(body),
      }),

    delete: (path: string) =>
      app.request(path, { method: 'DELETE', headers: hubHeaders }),

    json: (res: Response) => res.json() as Promise<any>,
  };
}

export type ApiHelper = ReturnType<typeof createApiHelper>;
