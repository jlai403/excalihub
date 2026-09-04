import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import * as SpaceService from '~/services/space.js';
import * as BackupService from '~/services/backup.js';
import * as BackupRepo from '~/repos/backup.js';
import { getDataDir, setGitConfig } from '~/repos/git.js';
import {
  prepareSpacesRepo,
  commitAndPush,
  parseRepoUrl,
  deleteSpaceFromGit,
  pruneOrphanedSpaces,
  syncRemoteHistory,
} from '~/services/git.js';

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

describe('commitAndPush', () => {
  it('writes .gitignore and untracks backups on a pre-feature repo', async () => {
    setGitConfig({
      repoUrl: 'git@github.com:user/repo.git',
      connected: true,
      connectedAt: new Date().toISOString(),
    });

    const dataDir = getDataDir();
    const spacesDir = join(dataDir, 'spaces');
    const spaceDir = join(spacesDir, 'testspace');
    mkdirSync(join(spaceDir, 'backups'), { recursive: true });
    writeFileSync(join(spaceDir, 'meta.json'), '{}\n');
    writeFileSync(join(spaceDir, 'backups', 'old.excalidraw'), '{}');

    const remoteDir = join(dataDir, 'remote.git');
    await simpleGit({ baseDir: dataDir }).raw(['init', '--bare', remoteDir]);

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.raw(['config', 'user.name', 'Test']);
    await git.raw(['config', 'user.email', 'test@example.com']);
    await git.add('.');
    await git.commit('initial');
    await git.addRemote('origin', remoteDir);

    const result = await commitAndPush(
      'testspace',
      '{"elements":[]}',
      null,
      'Update testspace',
    );
    expect(result).toEqual({ success: true });

    expect(existsSync(join(spacesDir, '.gitignore'))).toBe(true);

    const remoteTree = (
      await simpleGit({ baseDir: remoteDir }).raw([
        'ls-tree',
        '-r',
        '--name-only',
        'refs/heads/main',
      ])
    ).split('\n');
    expect(remoteTree).toContain('.gitignore');
    expect(remoteTree).toContain('testspace/testspace.excalidraw');
    expect(remoteTree.some((f) => f.includes('backups'))).toBe(false);
  });
});

describe('syncRemoteHistory', () => {
  it('syncs remote history even when the worktree holds a colliding untracked space dir', async () => {
    const dataDir = getDataDir();
    const spacesDir = join(dataDir, 'spaces');
    const remoteDir = join(dataDir, 'remote.git');
    await simpleGit({ baseDir: dataDir }).raw(['init', '--bare', remoteDir]);

    // A previous run's remote state: the same stable subdomain is tracked.
    const seedDir = join(dataDir, 'seed');
    mkdirSync(join(seedDir, 'my-project'), { recursive: true });
    writeFileSync(join(seedDir, 'my-project', 'meta.json'), '{"stale":true}\n');
    writeFileSync(
      join(seedDir, 'my-project', 'my-project.excalidraw'),
      '{"elements":[]}\n',
    );
    const seed = simpleGit({ baseDir: seedDir });
    await seed.init(['-b', 'main']);
    await seed.raw(['config', 'user.name', 'Test']);
    await seed.raw(['config', 'user.email', 'test@example.com']);
    await seed.add('.');
    await seed.commit('previous run');
    await seed.addRemote('origin', remoteDir);
    await seed.push('origin', 'main');

    // The live worktree already holds the same space dir (created before
    // connect), with different content — a plain pull aborts here and used
    // to silently leave an empty unborn main.
    mkdirSync(join(spacesDir, 'my-project'), { recursive: true });
    writeFileSync(join(spacesDir, 'my-project', 'meta.json'), '{"fresh":true}\n');

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.raw(['config', 'user.name', 'Test']);
    await git.raw(['config', 'user.email', 'test@example.com']);
    await git.addRemote('origin', remoteDir);

    await syncRemoteHistory(git);

    expect((await git.raw(['rev-parse', 'HEAD'])).trim()).toBe(
      (await git.raw(['rev-parse', 'origin/main'])).trim(),
    );
    expect((await git.log()).latest?.message).toBe('previous run');
    expect(readFileSync(join(spacesDir, 'my-project', 'meta.json'), 'utf-8')).toBe(
      '{"stale":true}\n',
    );

    // The next commit must fast-forward instead of being rejected.
    writeFileSync(
      join(spacesDir, 'my-project', 'my-project.excalidraw'),
      '{"elements":[1]}\n',
    );
    await git.add(['my-project/']);
    await git.commit('Update my-project');
    await git.push('origin', 'main');
    expect((await git.raw(['rev-parse', 'HEAD'])).trim()).toBe(
      (await git.raw(['rev-parse', 'origin/main'])).trim(),
    );
  });

  it('keeps unborn main when the remote has no main branch', async () => {
    const dataDir = getDataDir();
    const spacesDir = join(dataDir, 'spaces');
    const remoteDir = join(dataDir, 'remote.git');
    await simpleGit({ baseDir: dataDir }).raw(['init', '--bare', remoteDir]);

    mkdirSync(join(spacesDir, 'fresh-space'), { recursive: true });
    writeFileSync(join(spacesDir, 'fresh-space', 'meta.json'), '{}\n');

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.addRemote('origin', remoteDir);

    await syncRemoteHistory(git);

    // No --quiet: simple-git resolves quiet rev-parses of missing refs.
    const hasMain = await git
      .raw(['rev-parse', '--verify', 'main'])
      .then(() => true)
      .catch(() => false);
    expect(hasMain).toBe(false);
  });
});

describe('deleteSpaceFromGit', () => {
  it('removes a space directory from the remote', async () => {
    setGitConfig({
      repoUrl: 'git@github.com:user/repo.git',
      connected: true,
      connectedAt: new Date().toISOString(),
    });

    const dataDir = getDataDir();
    const spacesDir = join(dataDir, 'spaces');
    const goneDir = join(spacesDir, 'gone-space');
    mkdirSync(goneDir, { recursive: true });
    writeFileSync(join(goneDir, 'meta.json'), '{}\n');
    writeFileSync(join(goneDir, 'gone-space.excalidraw'), '{"elements":[]}\n');

    const remoteDir = join(dataDir, 'remote.git');
    await simpleGit({ baseDir: dataDir }).raw(['init', '--bare', remoteDir]);

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.raw(['config', 'user.name', 'Test']);
    await git.raw(['config', 'user.email', 'test@example.com']);
    await git.add('.');
    await git.commit('initial');
    await git.addRemote('origin', remoteDir);
    await git.push('origin', 'main');

    const result = await deleteSpaceFromGit('gone-space');
    expect(result).toEqual({ success: true });

    const remoteTree = (
      await simpleGit({ baseDir: remoteDir }).raw([
        'ls-tree',
        '-r',
        '--name-only',
        'refs/heads/main',
      ])
    ).split('\n');
    expect(remoteTree).not.toContain('gone-space/gone-space.excalidraw');
    expect(remoteTree).not.toContain('gone-space/meta.json');
  });

  it('returns error when git is not connected', async () => {
    setGitConfig({
      repoUrl: '',
      connected: false,
      connectedAt: null,
    });
    const result = await deleteSpaceFromGit('some-space');
    expect(result).toEqual({ success: false, error: 'Git not connected' });
  });
});

describe('pruneOrphanedSpaces', () => {
  it('removes tracked space dirs with no live space, keeps live ones', async () => {
    setGitConfig({
      repoUrl: 'git@github.com:user/repo.git',
      connected: true,
      connectedAt: new Date().toISOString(),
    });

    const dataDir = getDataDir();
    const spacesDir = join(dataDir, 'spaces');

    // Seed two tracked dirs as if from prior runs: an orphan and a live space.
    for (const sub of ['stale-space', 'keep-space']) {
      const dir = join(spacesDir, sub);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'meta.json'), '{}\n');
      writeFileSync(join(dir, `${sub}.excalidraw`), '{"elements":[]}\n');
    }

    const remoteDir = join(dataDir, 'remote.git');
    await simpleGit({ baseDir: dataDir }).raw(['init', '--bare', remoteDir]);

    const git = simpleGit({ baseDir: spacesDir });
    await git.init(['-b', 'main']);
    await git.raw(['config', 'user.name', 'Test']);
    await git.raw(['config', 'user.email', 'test@example.com']);
    await git.add('.');
    await git.commit('initial');
    await git.addRemote('origin', remoteDir);
    await git.push('origin', 'main');

    // Only keep-space is a live space; stale-space is an orphan.
    await SpaceService.createSpace('Keep Space');

    const result = await pruneOrphanedSpaces();
    expect(result).toEqual({ pruned: 1, deleted: ['stale-space'] });

    const remoteTree = (
      await simpleGit({ baseDir: remoteDir }).raw([
        'ls-tree',
        '-r',
        '--name-only',
        'refs/heads/main',
      ])
    ).split('\n');
    expect(remoteTree).not.toContain('stale-space/stale-space.excalidraw');
    expect(remoteTree).toContain('keep-space/keep-space.excalidraw');
  });

  it('returns empty result when git is not connected', async () => {
    setGitConfig({
      repoUrl: '',
      connected: false,
      connectedAt: null,
    });
    const result = await pruneOrphanedSpaces();
    expect(result).toEqual({ pruned: 0, deleted: [] });
  });
});

describe('parseRepoUrl', () => {
  it('parses a GitHub scp-style url without a port', () => {
    expect(parseRepoUrl('git@github.com:user/repo.git')).toEqual({
      host: 'github.com',
    });
  });

  it('parses a self-hosted scp-style url', () => {
    expect(
      parseRepoUrl('git@git.ts.jlai.ca:jlai/excalihub-spaces.git'),
    ).toEqual({ host: 'git.ts.jlai.ca' });
  });

  it('parses an ssh:// url with an explicit port', () => {
    expect(
      parseRepoUrl('ssh://git@git.ts.jlai.ca:443/jlai/excalihub-spaces.git'),
    ).toEqual({ host: 'git.ts.jlai.ca', port: 443 });
  });

  it('parses an ssh:// url without an explicit port', () => {
    expect(parseRepoUrl('ssh://git@git.ts.jlai.ca/jlai/repo.git')).toEqual({
      host: 'git.ts.jlai.ca',
    });
  });

  it('rejects https urls', () => {
    expect(parseRepoUrl('https://github.com/foo/bar')).toBeNull();
  });

  it('rejects urls without a .git suffix', () => {
    expect(parseRepoUrl('git@github.com:user/repo')).toBeNull();
  });

  it('rejects non-ssh hosts', () => {
    expect(parseRepoUrl('https://git.ts.jlai.ca/jlai/repo.git')).toBeNull();
  });
});
