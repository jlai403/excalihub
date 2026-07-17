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

describe('createSpace', () => {
  it('generates correct subdomain from name', async () => {
    const space = await SpaceService.createSpace('Hello World!!!');
    expect(space.subdomain).toBe('hello-world');
  });

  it('trims leading and trailing dashes from slug', async () => {
    const space = await SpaceService.createSpace('-already-slugged-');
    expect(space.subdomain).toBe('already-slugged');
  });

  it('collapses consecutive special chars into single hyphen', async () => {
    const space = await SpaceService.createSpace('foo___bar');
    expect(space.subdomain).toBe('foo-bar');
  });

  it('returns empty subdomain for empty name', async () => {
    const space = await SpaceService.createSpace('');
    expect(space.subdomain).toBe('');
  });
});

describe('createBackup', () => {
  it('creates a backup and stores structured file data', async () => {
    await SpaceService.createSpace('Test');
    const result = await BackupService.createBackup('test', '[{"id":"1"}]', '{"theme":"dark"}');

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('backupId');

    const stored = await BackupRepo.getBackupById((result as any).backupId);
    const parsed = JSON.parse(stored!.fileData);
    expect(parsed.elements).toEqual([{ id: '1' }]);
    expect(parsed.appState).toEqual({ theme: 'dark' });
    expect(parsed.files).toEqual({});
  });

  it('uses empty appState when not provided', async () => {
    await SpaceService.createSpace('Test');
    const result = await BackupService.createBackup('test', '[{"id":"1"}]');

    const stored = await BackupRepo.getBackupById((result as any).backupId);
    const parsed = JSON.parse(stored!.fileData);
    expect(parsed.appState).toEqual({});
  });

  it('deduplicates identical backups', async () => {
    await SpaceService.createSpace('Dedup');
    const r1 = await BackupService.createBackup('dedup', '[{"id":"1"}]', null);
    expect(r1).toEqual({ success: true, backupId: expect.any(Number) });

    const r2 = await BackupService.createBackup('dedup', '[{"id":"1"}]', null);
    expect(r2).toEqual({ success: true, deduplicated: true });
  });

  it('does not deduplicate different content', async () => {
    await SpaceService.createSpace('Multi');
    const r1 = await BackupService.createBackup('multi', '[{"id":"1"}]', null);
    const r2 = await BackupService.createBackup('multi', '[{"id":"2"}]', null);
    expect((r1 as any).backupId).not.toBe((r2 as any).backupId);
  });

  it('throws when space not found', async () => {
    await expect(
      BackupService.createBackup('nonexistent', '[]')
    ).rejects.toThrow('Space not found');
  });

  it('throws on invalid JSON in elements', async () => {
    await SpaceService.createSpace('Test');
    await expect(
      BackupService.createBackup('test', 'not-json')
    ).rejects.toThrow('Invalid backup data');
  });

  it('throws on invalid JSON in appState', async () => {
    await SpaceService.createSpace('Test');
    await expect(
      BackupService.createBackup('test', '[]', 'not-json')
    ).rejects.toThrow('Invalid backup data');
  });
});
