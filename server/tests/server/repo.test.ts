import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createHash, randomBytes } from 'crypto';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import {
  createSpace,
  getSpaceById,
  getSpaceBySubdomain,
  getAllSpaces,
  deleteSpace,
} from '../../src/repos/space.js';
import {
  createBackup,
  getBackupsBySpaceId,
  getBackupById,
  getLatestBackupHash,
} from '../../src/repos/backup.js';

beforeEach(() => {
  setupTestDb();
});

afterEach(() => {
  cleanupTestDb();
});

describe('createSpace', () => {
  it('creates a space and returns it with correct fields', () => {
    const space = createSpace('My Project', 'my-project');

    expect(space).toBeDefined();
    expect(space.id).toBeDefined();
    expect(space.id.length).toBe(10);
    expect(space.name).toBe('My Project');
    expect(space.subdomain).toBe('my-project');
    expect(space.createdAt).toBeDefined();
    expect(space.updatedAt).toBeDefined();
    expect(space.latest_backup).toBeNull();
  });

  it('throws on duplicate name', () => {
    createSpace('My Project', 'my-project');

    expect(() => createSpace('My Project', 'my-project-2')).toThrow(
      'already exists',
    );
  });

  it('throws on duplicate subdomain', () => {
    createSpace('Project A', 'shared-name');

    expect(() => createSpace('Project B', 'shared-name')).toThrow(
      'already exists',
    );
  });
});

describe('getSpaceBySubdomain', () => {
  it('returns the space when found', () => {
    createSpace('Test', 'test-space');
    const space = getSpaceBySubdomain('test-space');

    expect(space).toBeDefined();
    expect(space!.name).toBe('Test');
    expect(space!.subdomain).toBe('test-space');
  });

  it('returns undefined when not found', () => {
    expect(getSpaceBySubdomain('nonexistent')).toBeUndefined();
  });
});

describe('getSpaceById', () => {
  it('returns the space when found', () => {
    const created = createSpace('Test', 'test-space');
    const space = getSpaceById(created.id);

    expect(space).toBeDefined();
    expect(space!.name).toBe('Test');
  });

  it('returns undefined when not found', () => {
    expect(getSpaceById('nonexistent-id')).toBeUndefined();
  });
});

describe('getAllSpaces', () => {
  it('returns empty array when no spaces exist', () => {
    expect(getAllSpaces()).toEqual([]);
  });

  it('returns all spaces', () => {
    createSpace('First', 'first');
    createSpace('Second', 'second');
    createSpace('Third', 'third');

    const spaces = getAllSpaces();
    expect(spaces).toHaveLength(3);
    const names = spaces.map((s) => s.name);
    expect(names).toContain('First');
    expect(names).toContain('Second');
    expect(names).toContain('Third');
  });
});

describe('deleteSpace', () => {
  it('deletes the space', () => {
    const space = createSpace('ToDelete', 'to-delete');
    deleteSpace(space.id);

    expect(getSpaceById(space.id)).toBeUndefined();
  });

  it('removes backup files when deleting space', async () => {
    const space = createSpace('WithBackups', 'with-backups');
    const hash = createHash('sha256').update('{"elements":[]}').digest('hex');
    await createBackup(space.subdomain, '{"elements":[]}', hash);
    await createBackup(
      space.subdomain,
      '{"elements":[1]}',
      createHash('sha256').update('{"elements":[1]}').digest('hex'),
    );

    deleteSpace(space.id);

    expect(getBackupsBySpaceId(space.subdomain)).toEqual([]);
  });

  it('does not throw when deleting nonexistent space', () => {
    deleteSpace('nonexistent-id');
  });
});

describe('createBackup', () => {
  it('creates a backup and returns its filename', async () => {
    const space = createSpace('Test', 'test');
    const hash = createHash('sha256').update('{"elements":[]}').digest('hex');
    const result = await createBackup(space.subdomain, '{"elements":[]}', hash);

    expect(result).toBeDefined();
    expect(result.filename).toBeDefined();
    expect(result.filename).toMatch(/^\d+-[a-z0-9]+-[a-f0-9]+\.excalidraw$/);
    expect(result.deduplicated).toBeUndefined();
  });

  it('links backup to the correct space', async () => {
    const space1 = createSpace('Space1', 'space1');
    const space2 = createSpace('Space2', 'space2');
    const hash1 = createHash('sha256').update('{"a":1}').digest('hex');
    const hash2 = createHash('sha256').update('{"b":2}').digest('hex');
    await createBackup(space1.subdomain, '{"a":1}', hash1);
    await createBackup(space2.subdomain, '{"b":2}', hash2);

    const backups1 = getBackupsBySpaceId(space1.subdomain);
    const backups2 = getBackupsBySpaceId(space2.subdomain);

    expect(backups1).toHaveLength(1);
    expect(backups1[0].hash).toBe(hash1.slice(0, 8));
    expect(backups2).toHaveLength(1);
    expect(backups2[0].hash).toBe(hash2.slice(0, 8));
  });
});

describe('getBackupsBySpaceId', () => {
  it('returns backups ordered by most recent first', async () => {
    const space = createSpace('Test', 'test');
    const h1 = createHash('sha256').update('{"a":1}').digest('hex');
    const h2 = createHash('sha256').update('{"b":2}').digest('hex');
    const h3 = createHash('sha256').update('{"c":3}').digest('hex');

    await createBackup(space.subdomain, '{"a":1}', h1);
    await createBackup(space.subdomain, '{"b":2}', h2);
    await createBackup(space.subdomain, '{"c":3}', h3);

    const backups = getBackupsBySpaceId(space.subdomain);
    expect(backups).toHaveLength(3);
    const hashes = backups.map((b) => b.hash);
    expect(hashes).toContain(h1.slice(0, 8));
    expect(hashes).toContain(h2.slice(0, 8));
    expect(hashes).toContain(h3.slice(0, 8));
  });

  it('does not include file content in listing', async () => {
    const space = createSpace('Test', 'test');
    const hash = createHash('sha256')
      .update('{"sensitive":true}')
      .digest('hex');
    await createBackup(space.subdomain, '{"sensitive":true}', hash);

    const backups = getBackupsBySpaceId(space.subdomain);
    expect(backups[0]).not.toHaveProperty('data');
    expect(backups[0]).toHaveProperty('filename');
    expect(backups[0]).toHaveProperty('hash');
    expect(backups[0]).toHaveProperty('createdAt');
  });

  it('returns empty array for space with no backups', () => {
    createSpace('Test', 'test');
    expect(getBackupsBySpaceId('test')).toEqual([]);
  });
});

describe('getBackupById', () => {
  it('returns backup data when found by filename', async () => {
    const space = createSpace('Test', 'test');
    const hash = createHash('sha256').update('{"data":true}').digest('hex');
    const result = await createBackup(space.subdomain, '{"data":true}', hash);
    expect(result.deduplicated).toBeUndefined();

    const backup = getBackupById(result.filename);
    expect(backup).not.toBeNull();
    expect(backup!.data).toBe('{"data":true}');
    expect(backup!.subdomain).toBe('test');
  });

  it('returns null when not found', () => {
    expect(getBackupById('nonexistent-file.excalidraw')).toBeNull();
  });
});

describe('getLatestBackupHash', () => {
  it('returns the hash prefix of the latest backup', async () => {
    const space = createSpace('Test', 'test');
    const hash = createHash('sha256').update('{"a":1}').digest('hex');
    await createBackup(space.subdomain, '{"a":1}', hash);

    const result = getLatestBackupHash(space.subdomain);
    expect(result).toBe(hash.slice(0, 8));
  });

  it('returns undefined when no backups exist', () => {
    const space = createSpace('Test', 'test');
    expect(getLatestBackupHash(space.subdomain)).toBeNull();
  });

  it('returns null for nonexistent space', () => {
    expect(getLatestBackupHash('nonexistent')).toBeNull();
  });
});
