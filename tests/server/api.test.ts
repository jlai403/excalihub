import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { getDb, resetDb } from '../../src/server/db.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import { createApiHelper, type ApiHelper } from '../helpers/request.js';
import { SpaceFixture } from '../fixtures/index.js';

let app: ReturnType<typeof createApp>;
let api: ApiHelper;
let fixture: SpaceFixture;

beforeEach(async () => {
  const dbPath = setupTestDb();
  resetDb();
  await getDb(dbPath);
  app = createApp();
  api = createApiHelper(app);
  fixture = new SpaceFixture(app);
});

afterEach(() => {
  cleanupTestDb();
});

describe('GET /api/spaces', () => {
  it('returns empty array when no spaces exist', async () => {
    const res = await api.get('/api/spaces');
    expect(res.status).toBe(200);
    expect(await api.json(res)).toEqual([]);
  });

  it('returns all created spaces', async () => {
    await fixture
      .addSpace('Space A')
      .addSpace('Space B')
      .execute();

    const res = await api.get('/api/spaces');
    expect(res.status).toBe(200);
    expect(await api.json(res)).toHaveLength(2);
  });
});

describe('GET /api/spaces/:id', () => {
  it('returns the space when found', async () => {
    await fixture
      .addSpace('Test')
      .execute();

    const res = await api.get(`/api/spaces/${fixture.spaceIds[0]}`);
    expect(res.status).toBe(200);
    expect((await api.json(res)).name).toBe('Test');
  });

  it('returns 404 when space not found', async () => {
    const res = await api.get('/api/spaces/999');
    expect(res.status).toBe(404);
    expect(await api.json(res)).toEqual({ error: 'Space not found' });
  });
});

describe('POST /api/spaces', () => {
  it('creates a space and returns 201', async () => {
    const res = await api.post('/api/spaces', { name: 'My Project' });
    expect(res.status).toBe(201);
    const space = await api.json(res);
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
  });

  it('generates correct slug from name', async () => {
    const res = await api.post('/api/spaces', { name: 'Hello World!!!' });
    const space = await api.json(res);
    expect(space.subdomain).toBe('hello-world');
  });

  it('trims leading/trailing dashes from slug', async () => {
    const res = await api.post('/api/spaces', { name: '-already-slugged-' });
    const space = await api.json(res);
    expect(space.subdomain).toBe('already-slugged');
  });

  it('returns 400 when name is missing', async () => {
    const res = await api.post('/api/spaces', {});
    expect(res.status).toBe(400);
    expect(await api.json(res)).toEqual({ error: 'Name is required' });
  });

  it('returns 400 when name is not a string', async () => {
    const res = await api.post('/api/spaces', { name: 123 });
    expect(res.status).toBe(400);
  });

  it('returns 409 when name already exists', async () => {
    await fixture
      .addSpace('Duplicate')
      .execute();
    const res = await api.post('/api/spaces', { name: 'Duplicate' });
    expect(res.status).toBe(409);
    expect(await api.json(res)).toEqual({ error: 'Space name already exists' });
  });
});

describe('DELETE /api/spaces/:id', () => {
  it('deletes the space and returns success', async () => {
    await fixture
      .addSpace('ToDelete')
      .execute();

    const res = await api.delete(`/api/spaces/${fixture.spaceIds[0]}`);
    expect(res.status).toBe(200);
    expect(await api.json(res)).toEqual({ success: true });

    const getRes = await api.get(`/api/spaces/${fixture.spaceIds[0]}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when space not found', async () => {
    const res = await api.delete('/api/spaces/999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/spaces/:id/backups', () => {
  it('returns backups for the space', async () => {
    await fixture
      .addSpace('WithBackups')
      .addBackup('WithBackups', { elements: JSON.stringify([{ id: '1' }]) })
      .execute();

    const res = await api.get(`/api/spaces/${fixture.spaceIds[0]}/backups`);
    expect(res.status).toBe(200);
    expect(await api.json(res)).toHaveLength(1);
  });

  it('returns 404 when space not found', async () => {
    const res = await api.get('/api/spaces/999/backups');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/backup', () => {
  it('creates a backup and returns backupId', async () => {
    await fixture
      .addSpace('Test')
      .execute();

    const res = await api.post('/api/backup', {
      subdomain: fixture.spaceByName('Test')!.subdomain,
      elements: JSON.stringify([{ id: 'elem1' }]),
      appState: JSON.stringify({ theme: 'dark' }),
    });
    expect(res.status).toBe(200);
    const body = await api.json(res);
    expect(body.success).toBe(true);
    expect(body.backupId).toBeDefined();
  });

  it('returns 400 when subdomain is missing', async () => {
    const res = await api.post('/api/backup', { elements: '[]' });
    expect(res.status).toBe(400);
    expect(await api.json(res)).toEqual({ error: 'Subdomain and elements required' });
  });

  it('returns 400 when elements is missing', async () => {
    const res = await api.post('/api/backup', { subdomain: 'test' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when space not found', async () => {
    const res = await api.post('/api/backup', {
      subdomain: 'nonexistent',
      elements: '[]',
    });
    expect(res.status).toBe(404);
  });

  it('deduplicates identical backups', async () => {
    await fixture
      .addSpace('Dedup')
      .execute();
    const subdomain = fixture.spaceByName('Dedup')!.subdomain;

    const backupBody = {
      subdomain,
      elements: JSON.stringify([{ id: '1' }]),
      appState: null,
    };

    const res1 = await api.post('/api/backup', backupBody);
    const body1 = await api.json(res1);
    expect(body1.deduplicated).toBeUndefined();

    const res2 = await api.post('/api/backup', backupBody);
    const body2 = await api.json(res2);
    expect(body2.deduplicated).toBe(true);
  });
});

describe('GET /api/backups/:id', () => {
  it('downloads backup as .excalidraw file', async () => {
    await fixture
      .addSpace('Download')
      .addBackup('Download', { elements: JSON.stringify([{ id: '1' }]) })
      .execute();

    const res = await api.get(`/api/backups/${fixture.backups[0].id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('content-disposition')).toContain('.excalidraw');
    const data = await api.json(res);
    expect(data.elements).toBeDefined();
  });

  it('returns 404 when backup not found', async () => {
    const res = await api.get('/api/backups/999');
    expect(res.status).toBe(404);
  });
});
