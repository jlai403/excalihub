import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../../src/app.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import { createApiHelper, type ApiHelper } from '../helpers/request.js';
import * as SpaceService from '~/services/space.js';
import * as FileService from '~/services/file.js';

function binaryFile(id: string) {
  return {
    id,
    mimeType: 'image/png',
    dataURL: 'data:image/png;base64,AAAA',
    created: 1,
  };
}

describe('file store service', () => {
  beforeEach(() => {
    setupTestDb();
  });
  afterEach(() => {
    cleanupTestDb();
  });

  it('stores and resolves files by id', async () => {
    await SpaceService.createSpace('Files');
    const saved = FileService.saveFiles('files', {
      'file-1': binaryFile('file-1'),
      'file-2': binaryFile('file-2'),
    });
    expect(saved).toBe(2);

    expect(FileService.getFiles('files', ['file-1', 'missing'])).toEqual({
      'file-1': binaryFile('file-1'),
    });
  });

  it('overwrites an existing file id', async () => {
    await SpaceService.createSpace('Overwrite');
    FileService.saveFiles('overwrite', { a: binaryFile('a') });
    const changed = { ...binaryFile('a'), dataURL: 'data:image/png;base64,BBBB' };
    FileService.saveFiles('overwrite', { a: changed });
    expect(FileService.getFiles('overwrite', ['a'])).toEqual({ a: changed });
  });

  it('rejects invalid payloads', async () => {
    await SpaceService.createSpace('Invalid');
    expect(() => FileService.saveFiles('invalid', null)).toThrow('Invalid files payload');
    expect(() => FileService.saveFiles('invalid', { 'bad id!': binaryFile('bad id!') })).toThrow(
      'Invalid file id',
    );
    expect(() => FileService.saveFiles('invalid', { x: binaryFile('y') })).toThrow(
      'File id mismatch',
    );
    expect(() =>
      FileService.saveFiles('invalid', { x: { id: 'x', mimeType: 'image/png' } }),
    ).toThrow('Invalid file data');
  });

  it('rejects files above the size cap', async () => {
    await SpaceService.createSpace('Big');
    const huge = { ...binaryFile('huge'), dataURL: 'x'.repeat(8_000_001) };
    expect(() => FileService.saveFiles('big', { huge })).toThrow('File too large');
  });

  it('throws for an unknown space', () => {
    expect(() => FileService.saveFiles('nope', {})).toThrow('Space not found');
  });
});

describe('POST /api/spaces/:id/files', () => {
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

  it('stores files and returns the count', async () => {
    const space = await SpaceService.createSpace('Api Files');
    const res = await api.post(`/api/spaces/${space.id}/files`, {
      files: { f1: binaryFile('f1') },
    });
    expect(res.status).toBe(200);
    expect(await api.json(res)).toEqual({ saved: 1 });
    expect(FileService.getFiles(space.subdomain, ['f1'])).toEqual({ f1: binaryFile('f1') });
  });

  it('404s for an unknown space', async () => {
    const res = await api.post('/api/spaces/does-not-exist/files', {
      files: {},
    });
    expect(res.status).toBe(404);
  });

  it('400s on an invalid payload', async () => {
    const space = await SpaceService.createSpace('Api Invalid');
    const res = await api.post(`/api/spaces/${space.id}/files`, {
      files: { x: { id: 'y' } },
    });
    expect(res.status).toBe(400);
  });
});
