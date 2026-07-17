import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { getDb, resetDb } from '../../src/server/db.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  const dbPath = setupTestDb();
  resetDb();
  await getDb(dbPath);
  app = createApp();
});

afterEach(() => {
  cleanupTestDb();
});

describe('GET /api/spaces', () => {
  it('returns empty array when no spaces exist', async () => {
    const res = await app.request('/api/spaces');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns all created spaces', async () => {
    await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Space A' }),
    });
    await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Space B' }),
    });

    const res = await app.request('/api/spaces');
    expect(res.status).toBe(200);
    const spaces = await res.json();
    expect(spaces).toHaveLength(2);
  });
});

describe('GET /api/spaces/:id', () => {
  it('returns the space when found', async () => {
    const createRes = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/spaces/${created.id}`);
    expect(res.status).toBe(200);
    const space = await res.json();
    expect(space.name).toBe('Test');
  });

  it('returns 404 when space not found', async () => {
    const res = await app.request('/api/spaces/999');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Space not found' });
  });
});

describe('POST /api/spaces', () => {
  it('creates a space and returns 201', async () => {
    const res = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Project' }),
    });
    expect(res.status).toBe(201);
    const space = await res.json();
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
  });

  it('generates correct slug from name', async () => {
    const res = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hello World!!!' }),
    });
    const space = await res.json();
    expect(space.subdomain).toBe('hello-world');
  });

  it('trims leading/trailing dashes from slug', async () => {
    const res = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '-already-slugged-' }),
    });
    const space = await res.json();
    expect(space.subdomain).toBe('already-slugged');
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Name is required' });
  });

  it('returns 400 when name is not a string', async () => {
    const res = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 when name already exists', async () => {
    await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate' }),
    });

    const res = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate' }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Space name already exists' });
  });
});

describe('DELETE /api/spaces/:id', () => {
  it('deletes the space and returns success', async () => {
    const createRes = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToDelete' }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/spaces/${created.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // Verify deleted
    const getRes = await app.request(`/api/spaces/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when space not found', async () => {
    const res = await app.request('/api/spaces/999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/spaces/:id/backups', () => {
  it('returns backups for the space', async () => {
    const createRes = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'WithBackups' }),
    });
    const space = await createRes.json();

    await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: space.subdomain,
        elements: JSON.stringify([{ id: '1' }]),
        appState: null,
      }),
    });

    const res = await app.request(`/api/spaces/${space.id}/backups`);
    expect(res.status).toBe(200);
    const backups = await res.json();
    expect(backups).toHaveLength(1);
  });

  it('returns 404 when space not found', async () => {
    const res = await app.request('/api/spaces/999/backups');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/backup', () => {
  it('creates a backup and returns backupId', async () => {
    const createRes = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    const space = await createRes.json();

    const res = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: space.subdomain,
        elements: JSON.stringify([{ id: 'elem1' }]),
        appState: JSON.stringify({ theme: 'dark' }),
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.backupId).toBeDefined();
  });

  it('returns 400 when subdomain is missing', async () => {
    const res = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements: '[]' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Subdomain and elements required' });
  });

  it('returns 400 when elements is missing', async () => {
    const res = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when space not found', async () => {
    const res = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: 'nonexistent',
        elements: '[]',
      }),
    });
    expect(res.status).toBe(404);
  });

  it('deduplicates identical backups', async () => {
    const createRes = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dedup' }),
    });
    const space = await createRes.json();

    const backupBody = {
      subdomain: space.subdomain,
      elements: JSON.stringify([{ id: '1' }]),
      appState: null,
    };

    const res1 = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupBody),
    });
    const body1 = await res1.json();
    expect(body1.deduplicated).toBeUndefined();

    const res2 = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupBody),
    });
    const body2 = await res2.json();
    expect(body2.deduplicated).toBe(true);
  });
});

describe('GET /api/backups/:id', () => {
  it('downloads backup as .excalidraw file', async () => {
    const createRes = await app.request('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Download' }),
    });
    const space = await createRes.json();

    const backupRes = await app.request('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain: space.subdomain,
        elements: JSON.stringify([{ id: '1' }]),
        appState: null,
      }),
    });
    const backup = await backupRes.json();

    const res = await app.request(`/api/backups/${backup.backupId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('content-disposition')).toContain('.excalidraw');
    const data = await res.json();
    expect(data.elements).toBeDefined();
  });

  it('returns 404 when backup not found', async () => {
    const res = await app.request('/api/backups/999');
    expect(res.status).toBe(404);
  });
});
