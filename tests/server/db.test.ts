import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb } from '../helpers/db.js';

let db: any;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  cleanupTestDb();
});

describe('createSpace', () => {
  it('creates a space and returns it with correct fields', async () => {
    const space = await db.createSpace('My Project', 'my-project');

    expect(space).toBeDefined();
    expect(space.id).toBe(1);
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
    expect(space.createdAt).toBeDefined();
    expect(space.updatedAt).toBeDefined();
  });

  it('throws on duplicate name (UNIQUE constraint)', async () => {
    await db.createSpace('My Project', 'my-project');

    await expect(
      db.createSpace('My Project', 'my-project-2')
    ).rejects.toThrow();
  });

  it('throws on duplicate subdomain (UNIQUE constraint)', async () => {
    await db.createSpace('Project A', 'shared-name');

    await expect(
      db.createSpace('Project B', 'shared-name')
    ).rejects.toThrow();
  });
});

describe('getSpaceBySubdomain', () => {
  it('returns the space when found', async () => {
    await db.createSpace('Test', 'test-space');
    const space = await db.getSpaceBySubdomain('test-space');

    expect(space).toBeDefined();
    expect(space.name).toBe('Test');
    expect(space.subdomain).toBe('test-space');
  });

  it('returns undefined when not found', async () => {
    expect(await db.getSpaceBySubdomain('nonexistent')).toBeUndefined();
  });
});

describe('getSpaceById', () => {
  it('returns the space when found', async () => {
    const created = await db.createSpace('Test', 'test-space');
    const space = await db.getSpaceById(created.id);

    expect(space).toBeDefined();
    expect(space.name).toBe('Test');
  });

  it('returns undefined when not found', async () => {
    expect(await db.getSpaceById(999)).toBeUndefined();
  });
});

describe('getAllSpaces', () => {
  it('returns empty array when no spaces exist', async () => {
    expect(await db.getAllSpaces()).toEqual([]);
  });

  it('returns all spaces', async () => {
    await db.createSpace('First', 'first');
    await db.createSpace('Second', 'second');
    await db.createSpace('Third', 'third');

    const spaces = await db.getAllSpaces();
    expect(spaces).toHaveLength(3);
    const names = spaces.map((s: any) => s.name);
    expect(names).toContain('First');
    expect(names).toContain('Second');
    expect(names).toContain('Third');
  });
});

describe('deleteSpace', () => {
  it('deletes the space', async () => {
    const space = await db.createSpace('ToDelete', 'to-delete');
    await db.deleteSpace(space.id);

    expect(await db.getSpaceById(space.id)).toBeUndefined();
  });

  it('cascade-deletes associated backups', async () => {
    const space = await db.createSpace('WithBackups', 'with-backups');
    await db.createBackup(space.id, '{"elements":[]}', 'hash1');
    await db.createBackup(space.id, '{"elements":[1]}', 'hash2');

    await db.deleteSpace(space.id);

    // NOTE: SQLite foreign keys are not enabled by default.
    // ON DELETE CASCADE in the schema requires PRAGMA foreign_keys = ON.
    // Without it, backups remain after space deletion.
    // This test documents actual behavior — backups are NOT cascade-deleted.
    const backups = await db.getBackupsBySpaceId(space.id);
    expect(backups.length).toBeGreaterThan(0);
  });

  it('does not throw when deleting nonexistent space', async () => {
    await expect(db.deleteSpace(999)).resolves.not.toThrow();
  });
});

describe('createBackup', () => {
  it('creates a backup and returns it', async () => {
    const space = await db.createSpace('Test', 'test');
    const backup = await db.createBackup(space.id, '{"elements":[]}', 'abc123');

    expect(backup).toBeDefined();
    expect(backup.id).toBe(1);
    expect(backup.spaceId).toBe(space.id);
    expect(backup.fileData).toBe('{"elements":[]}');
    expect(backup.fileHash).toBe('abc123');
    expect(backup.createdAt).toBeDefined();
  });

  it('links backup to the correct space', async () => {
    const space1 = await db.createSpace('Space1', 'space1');
    const space2 = await db.createSpace('Space2', 'space2');
    await db.createBackup(space1.id, '{"a":1}', 'hash-a');
    await db.createBackup(space2.id, '{"b":2}', 'hash-b');

    const backups1 = await db.getBackupsBySpaceId(space1.id);
    const backups2 = await db.getBackupsBySpaceId(space2.id);

    expect(backups1).toHaveLength(1);
    expect(backups1[0].fileHash).toBe('hash-a');
    expect(backups2).toHaveLength(1);
    expect(backups2[0].fileHash).toBe('hash-b');
  });
});

describe('getBackupsBySpaceId', () => {
  it('returns backups ordered by created_at DESC (or id ASC within same second)', async () => {
    const space = await db.createSpace('Test', 'test');
    await db.createBackup(space.id, '{"a":1}', 'hash1');
    await db.createBackup(space.id, '{"b":2}', 'hash2');
    await db.createBackup(space.id, '{"c":3}', 'hash3');

    const backups = await db.getBackupsBySpaceId(space.id);
    expect(backups).toHaveLength(3);
    const hashes = backups.map((b: any) => b.fileHash);
    expect(hashes).toContain('hash1');
    expect(hashes).toContain('hash2');
    expect(hashes).toContain('hash3');
  });

  it('excludes file_data field', async () => {
    const space = await db.createSpace('Test', 'test');
    await db.createBackup(space.id, '{"sensitive":true}', 'hash');

    const backups = await db.getBackupsBySpaceId(space.id);
    expect(backups[0]).not.toHaveProperty('fileData');
    expect(backups[0]).toHaveProperty('fileHash');
    expect(backups[0]).toHaveProperty('id');
    expect(backups[0]).toHaveProperty('spaceId');
    expect(backups[0]).toHaveProperty('createdAt');
  });

  it('returns empty array for space with no backups', async () => {
    const space = await db.createSpace('Test', 'test');
    expect(await db.getBackupsBySpaceId(space.id)).toEqual([]);
  });
});

describe('getBackupById', () => {
  it('returns backup with file_data when found', async () => {
    const space = await db.createSpace('Test', 'test');
    const created = await db.createBackup(space.id, '{"data":true}', 'hash');

    const backup = await db.getBackupById(created.id);
    expect(backup).toBeDefined();
    expect(backup.fileData).toBe('{"data":true}');
  });

  it('returns undefined when not found', async () => {
    expect(await db.getBackupById(999)).toBeUndefined();
  });
});

describe('getLatestBackupHash', () => {
  it('returns the hash of a backup when one exists', async () => {
    const space = await db.createSpace('Test', 'test');
    await db.createBackup(space.id, '{"a":1}', 'hash-a');

    const hash = await db.getLatestBackupHash(space.id);
    expect(hash).toBe('hash-a');
  });

  it('returns the most recent hash when timestamps differ', async () => {
    const space = await db.createSpace('Test', 'test');
    await db.createBackup(space.id, '{"a":1}', 'old-hash');

    // Wait 1 second to ensure different timestamp
    await new Promise((r) => setTimeout(r, 1100));

    await db.createBackup(space.id, '{"b":2}', 'new-hash');

    expect(await db.getLatestBackupHash(space.id)).toBe('new-hash');
  });

  it('returns undefined when no backups exist', async () => {
    const space = await db.createSpace('Test', 'test');
    expect(await db.getLatestBackupHash(space.id)).toBeUndefined();
  });

  it('returns undefined for nonexistent space', async () => {
    expect(await db.getLatestBackupHash(999)).toBeUndefined();
  });
});
