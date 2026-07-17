import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb } from '~/server/db.js';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import * as SpaceService from '~/server/services/space.js';
import * as BackupService from '~/server/services/backup.js';
import * as BackupRepo from '~/server/repositories/backup.js';

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
    expect(SpaceService.slugifyName('Hello World!!!')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(SpaceService.slugifyName('-already-slugged-')).toBe('already-slugged');
  });

  it('collapses consecutive non-alphanumeric chars into single hyphen', () => {
    expect(SpaceService.slugifyName('foo___bar')).toBe('foo-bar');
  });

  it('handles all lowercase name with no special chars', () => {
    expect(SpaceService.slugifyName('my-project')).toBe('my-project');
  });

  it('returns empty string for empty input', () => {
    expect(SpaceService.slugifyName('')).toBe('');
  });
});

describe('createSpace', () => {
  it('creates a space with auto-generated subdomain', async () => {
    const space = await SpaceService.createSpace('My Project');
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
    expect(space.id).toBeDefined();
  });
});

describe('getAllSpaces', () => {
  it('returns empty array when no spaces exist', async () => {
    expect(await SpaceService.getAllSpaces()).toEqual([]);
  });

  it('returns all spaces', async () => {
    await SpaceService.createSpace('First');
    await SpaceService.createSpace('Second');
    const spaces = await SpaceService.getAllSpaces();
    expect(spaces).toHaveLength(2);
  });
});

describe('getSpaceById', () => {
  it('returns the space when found', async () => {
    const created = await SpaceService.createSpace('Test');
    const space = await SpaceService.getSpaceById(created.id);
    expect(space).toBeDefined();
    expect(space!.name).toBe('Test');
  });

  it('returns undefined when not found', async () => {
    expect(await SpaceService.getSpaceById(999)).toBeUndefined();
  });
});

describe('deleteSpace', () => {
  it('deletes the space', async () => {
    const space = await SpaceService.createSpace('ToDelete');
    await SpaceService.deleteSpace(space.id);
    expect(await SpaceService.getSpaceById(space.id)).toBeUndefined();
  });
});

describe('buildFileData', () => {
  it('constructs JSON with parsed elements and appState', () => {
    const result = BackupService.buildFileData('[{"id":"1"}]', '{"theme":"dark"}');
    const parsed = JSON.parse(result);
    expect(parsed.elements).toEqual([{ id: '1' }]);
    expect(parsed.appState).toEqual({ theme: 'dark' });
    expect(parsed.files).toEqual({});
  });

  it('defaults appState to empty object when not provided', () => {
    const result = BackupService.buildFileData('[{"id":"1"}]');
    const parsed = JSON.parse(result);
    expect(parsed.appState).toEqual({});
  });

  it('defaults appState to empty object when null', () => {
    const result = BackupService.buildFileData('[{"id":"1"}]', null);
    const parsed = JSON.parse(result);
    expect(parsed.appState).toEqual({});
  });
});

describe('hashFileData', () => {
  it('returns a hex SHA256 hash', () => {
    const hash = BackupService.hashFileData('hello');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same hash for the same input', () => {
    expect(BackupService.hashFileData('test')).toBe(BackupService.hashFileData('test'));
  });

  it('returns different hashes for different inputs', () => {
    expect(BackupService.hashFileData('a')).not.toBe(BackupService.hashFileData('b'));
  });
});

describe('createBackup', () => {
  it('creates a backup and returns backupId', async () => {
    await SpaceService.createSpace('Test');
    const result = await BackupService.createBackup('test', '[{"id":"1"}]', '{"theme":"dark"}');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('backupId');
  });

  it('deduplicates identical backups', async () => {
    await SpaceService.createSpace('Dedup');
    const args = ['dedup', '[{"id":"1"}]', null] as const;

    const r1 = await BackupService.createBackup(...args);
    expect(r1).toEqual({ success: true, backupId: expect.any(Number) });

    const r2 = await BackupService.createBackup(...args);
    expect(r2).toEqual({ success: true, deduplicated: true });
  });

  it('does not deduplicate different content', async () => {
    await SpaceService.createSpace('Multi');
    const r1 = await BackupService.createBackup('multi', '[{"id":"1"}]', null);
    const r2 = await BackupService.createBackup('multi', '[{"id":"2"}]', null);
    expect(r1).toHaveProperty('backupId');
    expect(r2).toHaveProperty('backupId');
    expect((r1 as any).backupId).not.toBe((r2 as any).backupId);
  });

  it('throws when space not found', async () => {
    await expect(
      BackupService.createBackup('nonexistent', '[]')
    ).rejects.toThrow('Space not found');
  });
});

describe('getBackupsBySpaceId', () => {
  it('returns backups for a space', async () => {
    const space = await SpaceService.createSpace('WithBackups');
    await BackupRepo.createBackup(space.id, '{"elements":[]}', 'hash1');
    await BackupRepo.createBackup(space.id, '{"elements":[1]}', 'hash2');

    const backups = await BackupService.getBackupsBySpaceId(space.id);
    expect(backups).toHaveLength(2);
  });

  it('returns empty array when no backups', async () => {
    const space = await SpaceService.createSpace('Empty');
    expect(await BackupService.getBackupsBySpaceId(space.id)).toEqual([]);
  });
});
