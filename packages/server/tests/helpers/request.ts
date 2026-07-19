import type { Hono } from 'hono';

export function createApiHelper(app: Hono) {
  return {
    get: (path: string) => app.request(path),

    post: (path: string, body: unknown) =>
      app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),

    put: (path: string, body: unknown) =>
      app.request(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),

    patch: (path: string, body: unknown) =>
      app.request(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),

    delete: (path: string) => app.request(path, { method: 'DELETE' }),

    json: (res: Response) => res.json() as Promise<any>,
  };
}

export type ApiHelper = ReturnType<typeof createApiHelper>;
