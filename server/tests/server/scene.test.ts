import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../../src/app.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import { createApiHelper, type ApiHelper } from '../helpers/request.js';
import * as SpaceService from '~/services/space.js';
import * as BackupService from '~/services/backup.js';
import * as FileService from '~/services/file.js';
import * as SceneService from '~/services/scene.js';
import { sceneFingerprint } from '~/scene-fingerprint.js';

function imageElement(id: string, fileId: string) {
  return { id, type: 'image', x: 0, y: 0, fileId };
}

function pngFile(id: string) {
  return {
    id,
    mimeType: 'image/png',
    dataURL: 'data:image/png;base64,AAAA',
    created: 1,
  };
}

describe('scene service', () => {
  beforeEach(() => {
    setupTestDb();
  });
  afterEach(() => {
    cleanupTestDb();
  });

  it('returns the latest backup with its version', async () => {
    await SpaceService.createSpace('Scene');
    await BackupService.createBackup(
      'scene',
      JSON.stringify([{ id: '1', x: 1 }]),
      JSON.stringify({ theme: 'dark' }),
    );

    const scene = await SceneService.getScene('scene');
    expect(scene).not.toBeNull();
    expect(scene!.elements).toEqual([{ id: '1', x: 1 }]);
    expect(scene!.appState).toEqual({ theme: 'dark' });
    expect(scene!.meta.source).toBe('backup');
    expect(scene!.meta.filename).toBeString();
    expect(scene!.meta.version).toBe(sceneFingerprint([{ id: '1', x: 1 }]));
  });

  it('resolves referenced image files from the store', async () => {
    await SpaceService.createSpace('With Images');
    FileService.saveFiles('with-images', { f1: pngFile('f1') });
    await BackupService.createBackup(
      'with-images',
      JSON.stringify([imageElement('img', 'f1')]),
      null,
    );

    const scene = await SceneService.getScene('with-images');
    expect(scene!.files).toEqual({ f1: pngFile('f1') });
    expect(scene!.meta.version).toBe(sceneFingerprint([imageElement('img', 'f1')]));
  });

  it('returns null when there is no backup', async () => {
    await SpaceService.createSpace('Nothing');
    expect(await SceneService.getScene('nothing')).toBeNull();
  });

  it('returns null for git when git is not connected', async () => {
    await SpaceService.createSpace('Gitless');
    expect(await SceneService.getScene('gitless', { source: 'git' })).toBeNull();
  });

  it('throws for an unknown space', async () => {
    await expect(SceneService.getScene('missing')).rejects.toThrow('Space not found');
  });
});

describe('GET /api/spaces/:id/scene', () => {
  let app: ReturnType<typeof createApp>;
  let api: ApiHelper;

  beforeEach(() => {
    setupTestDb();
    app = createApp();
    api = createApiHelper(app);
  });
  afterEach(() => {
    cleanupTestDb();
  });

  it('returns the scene for a space with a backup', async () => {
    const space = await SpaceService.createSpace('Api Scene');
    await BackupService.createBackup(space.subdomain, JSON.stringify([{ id: '1' }]));

    const res = await api.get(`/api/spaces/${space.id}/scene`);
    expect(res.status).toBe(200);
    const scene = await api.json(res);
    expect(scene.elements).toEqual([{ id: '1' }]);
    expect(scene.meta.source).toBe('backup');
  });

  it('404s when the space has no scene', async () => {
    const space = await SpaceService.createSpace('Api Empty');
    const res = await api.get(`/api/spaces/${space.id}/scene`);
    expect(res.status).toBe(404);
  });

  it('404s for an unknown space', async () => {
    const res = await api.get('/api/spaces/nope/scene');
    expect(res.status).toBe(404);
  });

  it('exposes scene_version on GET /api/spaces/:id', async () => {
    const space = await SpaceService.createSpace('Api Version');
    await BackupService.createBackup(space.subdomain, JSON.stringify([{ id: 'v' }]));

    const res = await api.get(`/api/spaces/${space.id}`);
    const body = await api.json(res);
    expect(body.scene_version).toBe(sceneFingerprint([{ id: 'v' }]));
  });
});

describe('POST /api/backup version guard', () => {
  let app: ReturnType<typeof createApp>;
  let api: ApiHelper;

  beforeEach(() => {
    setupTestDb();
    app = createApp();
    api = createApiHelper(app);
  });
  afterEach(() => {
    cleanupTestDb();
  });

  it('returns 409 with the current version on a stale base', async () => {
    const space = await SpaceService.createSpace('Api Guard');
    const first = await api.post('/api/backup', {
      subdomain: space.subdomain,
      elements: JSON.stringify([{ id: '1' }]),
    });
    expect(first.status).toBe(200);
    const { version } = await api.json(first);

    const conflict = await api.post('/api/backup', {
      subdomain: space.subdomain,
      elements: JSON.stringify([{ id: '2' }]),
      baseVersion: 'stale-version',
    });
    expect(conflict.status).toBe(409);
    expect(await api.json(conflict)).toEqual({
      error: 'Scene changed on the server',
      currentVersion: version,
    });

    const forced = await api.post('/api/backup', {
      subdomain: space.subdomain,
      elements: JSON.stringify([{ id: '2' }]),
      baseVersion: 'stale-version',
      force: true,
    });
    expect(forced.status).toBe(200);
  });
});
