import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb } from '~/server/db.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import {
  slugifyName,
  createSpaceService,
  getAllSpacesService,
  getSpaceByIdService,
  deleteSpaceService,
} from '~/server/services/space.js';
import {
  buildFileData,
  hashFileData,
  createBackupService,
  getBackupsBySpaceIdService,
} from '~/server/services/backup.js';
import {
  createBackup,
} from '~/server/repositories/backup.js';

beforeEach(async () => {
  const dbPath = setupTestDb();
  resetDb();
  await getDb(dbPath);
});

afterEach(() => {
  cleanupTestDb();
});

describe('slugifyName', () => {
  it('lowercases and replaces special chars with hyphens', () => {
    expect(slugifyName('Hello World!!!')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyName('-already-slugged-')).toBe('already-slugged');
  });

  it('collapses consecutive non-alphanumeric chars into single hyphen', () => {
    expect(slugifyName('foo___bar')).toBe('foo-bar');
  });

  it('handles all lowercase name with no special chars', () => {
    expect(slugifyName('my-project')).toBe('my-project');
  });

  it('returns empty string for empty input', () => {
    expect(slugifyName('')).toBe('');
  });
});

describe('createSpaceService', () => {
  it('creates a space with auto-generated subdomain', async () => {
    const space = await createSpaceService('My Project');
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
    expect(space.id).toBeDefined();
  });
});

describe('getAllSpacesService', () => {
  it('returns empty array when no spaces exist', async () => {
    expect(await getAllSpacesService()).toEqual([]);
  });

  it('returns all spaces', async () => {
    await createSpaceService('First');
    await createSpaceService('Second');
    const spaces = await getAllSpacesService();
    expect(spaces).toHaveLength(2);
  });
});

describe('getSpaceByIdService', () => {
  it('returns the space when found', async () => {
    const created = await createSpaceService('Test');
    const space = await getSpaceByIdService(created.id);
    expect(space).toBeDefined();
    expect(space!.name).toBe('Test');
  });

  it('returns undefined when not found', async () => {
    expect(await getSpaceByIdService(999)).toBeUndefined();
  });
});

describe('deleteSpaceService', () => {
  it('deletes the space', async () => {
    const space = await createSpaceService('ToDelete');
    await deleteSpaceService(space.id);
    expect(await getSpaceByIdService(space.id)).toBeUndefined();
  });
});

describe('buildFileData', () => {
  it('constructs JSON with parsed elements and appState', () => {
    const result = buildFileData('[{"id":"1"}]', '{"theme":"dark"}');
    const parsed = JSON.parse(result);
    expect(parsed.elements).toEqual([{ id: '1' }]);
    expect(parsed.appState).toEqual({ theme: 'dark' });
    expect(parsed.files).toEqual({});
  });

  it('defaults appState to empty object when not provided', () => {
    const result = buildFileData('[{"id":"1"}]');
    const parsed = JSON.parse(result);
    expect(parsed.appState).toEqual({});
  });

  it('defaults appState to empty object when null', () => {
    const result = buildFileData('[{"id":"1"}]', null);
    const parsed = JSON.parse(result);
    expect(parsed.appState).toEqual({});
  });
});

describe('hashFileData', () => {
  it('returns a hex SHA256 hash', () => {
    const hash = hashFileData('hello');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same hash for the same input', () => {
    expect(hashFileData('test')).toBe(hashFileData('test'));
  });

  it('returns different hashes for different inputs', () => {
    expect(hashFileData('a')).not.toBe(hashFileData('b'));
  });
});

describe('createBackupService', () => {
  it('creates a backup and returns backupId', async () => {
    await createSpaceService('Test');
    const result = await createBackupService('test', '[{"id":"1"}]', '{"theme":"dark"}');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('backupId');
  });

  it('deduplicates identical backups', async () => {
    await createSpaceService('Dedup');
    const args = ['dedup', '[{"id":"1"}]', null] as const;

    const r1 = await createBackupService(...args);
    expect(r1).toEqual({ success: true, backupId: expect.any(Number) });

    const r2 = await createBackupService(...args);
    expect(r2).toEqual({ success: true, deduplicated: true });
  });

  it('does not deduplicate different content', async () => {
    await createSpaceService('Multi');
    const r1 = await createBackupService('multi', '[{"id":"1"}]', null);
    const r2 = await createBackupService('multi', '[{"id":"2"}]', null);
    expect(r1).toHaveProperty('backupId');
    expect(r2).toHaveProperty('backupId');
    expect((r1 as any).backupId).not.toBe((r2 as any).backupId);
  });

  it('throws when space not found', async () => {
    await expect(
      createBackupService('nonexistent', '[]')
    ).rejects.toThrow('Space not found');
  });
});

describe('getBackupsBySpaceIdService', () => {
  it('returns backups for a space', async () => {
    const space = await createSpaceService('WithBackups');
    await createBackup(space.id, '{"elements":[]}', 'hash1');
    await createBackup(space.id, '{"elements":[1]}', 'hash2');

    const backups = await getBackupsBySpaceIdService(space.id);
    expect(backups).toHaveLength(2);
  });

  it('returns empty array when no backups', async () => {
    const space = await createSpaceService('Empty');
    expect(await getBackupsBySpaceIdService(space.id)).toEqual([]);
  });
});
