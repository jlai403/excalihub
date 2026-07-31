import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import * as SpaceService from '~/services/space.js';
import * as BackupService from '~/services/backup.js';
import * as BackupRepo from '~/repos/backup.js';
import { getDataDir } from '~/repos/git.js';
import { prepareSpacesRepo } from '~/services/git.js';

beforeEach(() => {
  setupTestDb();
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

  it('throws on empty name', async () => {
    await expect(SpaceService.createSpace('')).rejects.toThrow(
      'Subdomain cannot be empty',
    );
  });
});

describe('createBackup', () => {
  it('creates a backup and stores structured file data', async () => {
    await SpaceService.createSpace('Test');
    const result = await BackupService.createBackup(
      'test',
      '[{"id":"1"}]',
      '{"theme":"dark"}',
    );

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('filename');

    const stored = BackupRepo.getBackupById((result as any).filename);
    const parsed = JSON.parse(stored!.data);
    expect(parsed.elements).toEqual([{ id: '1' }]);
    expect(parsed.appState).toEqual({ theme: 'dark' });
    expect(parsed.files).toEqual({});
  });

  it('uses empty appState when not provided', async () => {
    await SpaceService.createSpace('Test');
    const result = await BackupService.createBackup('test', '[{"id":"1"}]');

    const stored = BackupRepo.getBackupById((result as any).filename);
    const parsed = JSON.parse(stored!.data);
    expect(parsed.appState).toEqual({});
  });

  it('deduplicates identical backups', async () => {
    await SpaceService.createSpace('Dedup');
    const r1 = await BackupService.createBackup('dedup', '[{"id":"1"}]', null);
    expect(r1).toEqual({ success: true, filename: expect.any(String) });

    const r2 = await BackupService.createBackup('dedup', '[{"id":"1"}]', null);
    expect(r2).toEqual({ success: true, deduplicated: true });
  });

  it('does not deduplicate different content', async () => {
    await SpaceService.createSpace('Multi');
    const r1 = await BackupService.createBackup('multi', '[{"id":"1"}]', null);
    const r2 = await BackupService.createBackup('multi', '[{"id":"2"}]', null);
    expect((r1 as any).filename).not.toBe((r2 as any).filename);
  });

  it('throws when space not found', async () => {
    await expect(
      BackupService.createBackup('nonexistent', '[]'),
    ).rejects.toThrow('Space not found');
  });

  it('throws on invalid JSON in elements', async () => {
    await SpaceService.createSpace('Test');
    await expect(
      BackupService.createBackup('test', 'not-json'),
    ).rejects.toThrow('Invalid backup data');
  });

  it('throws on invalid JSON in appState', async () => {
    await SpaceService.createSpace('Test');
    await expect(
      BackupService.createBackup('test', '[]', 'not-json'),
    ).rejects.toThrow('Invalid backup data');
  });
});

describe('prepareSpacesRepo', () => {
  it('writes .gitignore ignoring backups and untracks committed backups', async () => {
    const spacesDir = join(getDataDir(), 'spaces');
    const spaceDir = join(spacesDir, 'testspace');
    mkdirSync(join(spaceDir, 'backups'), { recursive: true });
    writeFileSync(join(spaceDir, 'meta.json'), '{}\n');
    writeFileSync(join(spaceDir, 'backups', 'old.excalidraw'), '{}');

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.raw(['config', 'user.name', 'Test']);
    await git.raw(['config', 'user.email', 'test@example.com']);
    await git.add('.');
    await git.commit('initial');

    await prepareSpacesRepo(git, spacesDir);

    expect(readFileSync(join(spacesDir, '.gitignore'), 'utf-8')).toBe(
      '*/backups/\n',
    );

    const tracked = (await git.raw(['ls-files'])).split('\n');
    expect(tracked).toContain('testspace/meta.json');
    expect(tracked.some((f) => f.includes('backups'))).toBe(false);

    expect(existsSync(join(spaceDir, 'backups', 'old.excalidraw'))).toBe(true);

    const untracked = (await git.raw(['status', '--porcelain'])).trim();
    expect(untracked).toContain('D  testspace/backups/old.excalidraw');
    expect(untracked).not.toMatch(/\?\?\s+.*backups/);
  });

  it('keeps new backup files ignored after untrack', async () => {
    const spacesDir = join(getDataDir(), 'spaces');
    const spaceDir = join(spacesDir, 'testspace');
    mkdirSync(join(spaceDir, 'backups'), { recursive: true });
    writeFileSync(join(spaceDir, 'meta.json'), '{}\n');
    writeFileSync(join(spaceDir, 'backups', 'old.excalidraw'), '{}');

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.raw(['config', 'user.name', 'Test']);
    await git.raw(['config', 'user.email', 'test@example.com']);
    await git.add('.');
    await git.commit('initial');
    await prepareSpacesRepo(git, spacesDir);

    writeFileSync(join(spaceDir, 'backups', 'new.excalidraw'), '{}');

    const status = await git.status();
    expect(status.files.filter((f) => f.path.includes('backups'))).toEqual([
      expect.objectContaining({
        path: 'testspace/backups/old.excalidraw',
        index: 'D',
      }),
    ]);
  });
});
