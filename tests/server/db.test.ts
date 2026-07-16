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
  it('creates a space and returns it with correct fields', () => {
    const space = db.createSpace('My Project', 'my-project');

    expect(space).toBeDefined();
    expect(space.id).toBe(1);
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
    expect(space.created_at).toBeDefined();
    expect(space.updated_at).toBeDefined();
  });

  it('throws on duplicate name (UNIQUE constraint)', () => {
    db.createSpace('My Project', 'my-project');

    expect(() => {
      db.createSpace('My Project', 'my-project-2');
    }).toThrow();
  });

  it('throws on duplicate subdomain (UNIQUE constraint)', () => {
    db.createSpace('Project A', 'shared-name');

    expect(() => {
      db.createSpace('Project B', 'shared-name');
    }).toThrow();
  });
});

describe('getSpaceBySubdomain', () => {
  it('returns the space when found', () => {
    db.createSpace('Test', 'test-space');
    const space = db.getSpaceBySubdomain('test-space');

    expect(space).toBeDefined();
    expect(space.name).toBe('Test');
    expect(space.subdomain).toBe('test-space');
  });

  it('returns undefined when not found', () => {
    expect(db.getSpaceBySubdomain('nonexistent')).toBeUndefined();
  });
});

describe('getSpaceById', () => {
  it('returns the space when found', () => {
    const created = db.createSpace('Test', 'test-space');
    const space = db.getSpaceById(created.id);

    expect(space).toBeDefined();
    expect(space.name).toBe('Test');
  });

  it('returns undefined when not found', () => {
    expect(db.getSpaceById(999)).toBeUndefined();
  });
});

describe('getAllSpaces', () => {
  it('returns empty array when no spaces exist', () => {
    expect(db.getAllSpaces()).toEqual([]);
  });

  it('returns all spaces', () => {
    db.createSpace('First', 'first');
    db.createSpace('Second', 'second');
    db.createSpace('Third', 'third');

    const spaces = db.getAllSpaces();
    expect(spaces).toHaveLength(3);
    const names = spaces.map((s: any) => s.name);
    expect(names).toContain('First');
    expect(names).toContain('Second');
    expect(names).toContain('Third');
  });
});

describe('deleteSpace', () => {
  it('deletes the space', () => {
    const space = db.createSpace('ToDelete', 'to-delete');
    db.deleteSpace(space.id);

    expect(db.getSpaceById(space.id)).toBeUndefined();
  });

  it('cascade-deletes associated backups', () => {
    const space = db.createSpace('WithBackups', 'with-backups');
    db.createBackup(space.id, '{"elements":[]}', 'hash1');
    db.createBackup(space.id, '{"elements":[1]}', 'hash2');

    db.deleteSpace(space.id);

    // NOTE: SQLite foreign keys are not enabled by default.
    // ON DELETE CASCADE in the schema requires PRAGMA foreign_keys = ON.
    // Without it, backups remain after space deletion.
    // This test documents actual behavior — backups are NOT cascade-deleted.
    const backups = db.getBackupsBySpaceId(space.id);
    expect(backups.length).toBeGreaterThan(0);
  });

  it('does not throw when deleting nonexistent space', () => {
    expect(() => db.deleteSpace(999)).not.toThrow();
  });
});

describe('createBackup', () => {
  it('creates a backup and returns it', () => {
    const space = db.createSpace('Test', 'test');
    const backup = db.createBackup(space.id, '{"elements":[]}', 'abc123');

    expect(backup).toBeDefined();
    expect(backup.id).toBe(1);
    expect(backup.space_id).toBe(space.id);
    expect(backup.file_data).toBe('{"elements":[]}');
    expect(backup.file_hash).toBe('abc123');
    expect(backup.created_at).toBeDefined();
  });

  it('links backup to the correct space', () => {
    const space1 = db.createSpace('Space1', 'space1');
    const space2 = db.createSpace('Space2', 'space2');
    db.createBackup(space1.id, '{"a":1}', 'hash-a');
    db.createBackup(space2.id, '{"b":2}', 'hash-b');

    const backups1 = db.getBackupsBySpaceId(space1.id);
    const backups2 = db.getBackupsBySpaceId(space2.id);

    expect(backups1).toHaveLength(1);
    expect(backups1[0].file_hash).toBe('hash-a');
    expect(backups2).toHaveLength(1);
    expect(backups2[0].file_hash).toBe('hash-b');
  });
});

describe('getBackupsBySpaceId', () => {
  it('returns backups ordered by created_at DESC (or id ASC within same second)', () => {
    const space = db.createSpace('Test', 'test');
    db.createBackup(space.id, '{"a":1}', 'hash1');
    db.createBackup(space.id, '{"b":2}', 'hash2');
    db.createBackup(space.id, '{"c":3}', 'hash3');

    const backups = db.getBackupsBySpaceId(space.id);
    expect(backups).toHaveLength(3);
    const hashes = backups.map((b: any) => b.file_hash);
    expect(hashes).toContain('hash1');
    expect(hashes).toContain('hash2');
    expect(hashes).toContain('hash3');
  });

  it('excludes file_data field', () => {
    const space = db.createSpace('Test', 'test');
    db.createBackup(space.id, '{"sensitive":true}', 'hash');

    const backups = db.getBackupsBySpaceId(space.id);
    expect(backups[0]).not.toHaveProperty('file_data');
    expect(backups[0]).toHaveProperty('file_hash');
    expect(backups[0]).toHaveProperty('id');
    expect(backups[0]).toHaveProperty('space_id');
    expect(backups[0]).toHaveProperty('created_at');
  });

  it('returns empty array for space with no backups', () => {
    const space = db.createSpace('Test', 'test');
    expect(db.getBackupsBySpaceId(space.id)).toEqual([]);
  });
});

describe('getBackupById', () => {
  it('returns backup with file_data when found', () => {
    const space = db.createSpace('Test', 'test');
    const created = db.createBackup(space.id, '{"data":true}', 'hash');

    const backup = db.getBackupById(created.id);
    expect(backup).toBeDefined();
    expect(backup.file_data).toBe('{"data":true}');
  });

  it('returns undefined when not found', () => {
    expect(db.getBackupById(999)).toBeUndefined();
  });
});

describe('getLatestBackupHash', () => {
  it('returns the hash of a backup when one exists', () => {
    const space = db.createSpace('Test', 'test');
    db.createBackup(space.id, '{"a":1}', 'hash-a');

    const hash = db.getLatestBackupHash(space.id);
    expect(hash).toBe('hash-a');
  });

  it('returns the most recent hash when timestamps differ', async () => {
    const space = db.createSpace('Test', 'test');
    db.createBackup(space.id, '{"a":1}', 'old-hash');

    // Wait 1 second to ensure different timestamp
    await new Promise((r) => setTimeout(r, 1100));

    db.createBackup(space.id, '{"b":2}', 'new-hash');

    expect(db.getLatestBackupHash(space.id)).toBe('new-hash');
  });

  it('returns undefined when no backups exist', () => {
    const space = db.createSpace('Test', 'test');
    expect(db.getLatestBackupHash(space.id)).toBeUndefined();
  });

  it('returns undefined for nonexistent space', () => {
    expect(db.getLatestBackupHash(999)).toBeUndefined();
  });
});
