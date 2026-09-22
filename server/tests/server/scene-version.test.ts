import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { setupTestDb, cleanupTestDb } from '../helpers/db.js';
import * as SpaceService from '~/services/space.js';
import * as BackupService from '~/services/backup.js';
import * as BackupRepo from '~/repos/backup.js';
import * as SpaceRepo from '~/repos/space.js';
import { sceneFingerprint } from '~/scene-fingerprint.js';

function seedBackupFile(
  subdomain: string,
  ts: number,
  elements: unknown[],
  hash = 'abcdef12',
): string {
  const dir = join(process.env.DATA_DIR!, 'spaces', subdomain, 'backups');
  mkdirSync(dir, { recursive: true });
  const filename = `${ts}-seed0001-${hash}.excalidraw`;
  writeFileSync(
    join(dir, filename),
    JSON.stringify({
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements,
      appState: {},
      files: {},
    }),
  );
  return filename;
}

beforeEach(() => {
  setupTestDb();
});

afterEach(() => {
  cleanupTestDb();
});

describe('scene version tracking', () => {
  it('records scene_version + source on backup', async () => {
    await SpaceService.createSpace('Ver');
    await BackupService.createBackup('ver', JSON.stringify([{ id: '1', x: 1 }]));

    const space = SpaceRepo.getSpaceBySubdomain('ver')!;
    expect(space.scene_version).toBe(sceneFingerprint([{ id: '1', x: 1 }]));
    expect(space.scene_version_source).toBe(space.latest_backup);
    expect(space.scene_version_source).not.toBeNull();
  });

  it('pans (appState-only changes) do not change the version', async () => {
    await SpaceService.createSpace('Pan');
    const r1 = await BackupService.createBackup(
      'pan',
      JSON.stringify([{ id: '1' }]),
      JSON.stringify({ scrollX: 0 }),
    );
    const r2 = await BackupService.createBackup(
      'pan',
      JSON.stringify([{ id: '1' }]),
      JSON.stringify({ scrollX: 400 }),
    );
    expect((r1 as any).version).toBe((r2 as any).version);
  });
});

describe('optimistic-concurrency guard', () => {
  it('rejects a stale base version unless forced', async () => {
    await SpaceService.createSpace('Guard');
    const r1 = await BackupService.createBackup('guard', JSON.stringify([{ id: '1' }]));
    const v1 = (r1 as any).version;

    const conflict = await BackupService.createBackup(
      'guard',
      JSON.stringify([{ id: '2' }]),
      null,
      { baseVersion: 'deadbeefdeadbeef' },
    );
    expect(conflict).toEqual({
      success: false,
      conflict: true,
      currentVersion: v1,
    });

    const forced = await BackupService.createBackup(
      'guard',
      JSON.stringify([{ id: '2' }]),
      null,
      { baseVersion: 'deadbeefdeadbeef', force: true },
    );
    expect(forced.success).toBe(true);

    const ok = await BackupService.createBackup(
      'guard',
      JSON.stringify([{ id: '3' }]),
      null,
      { baseVersion: (forced as any).version },
    );
    expect(ok.success).toBe(true);
  });

  it('accepts writes when there is no current version', async () => {
    await SpaceService.createSpace('Fresh');
    const r = await BackupService.createBackup(
      'fresh',
      JSON.stringify([{ id: '1' }]),
      null,
      { baseVersion: 'anything' },
    );
    expect(r.success).toBe(true);
  });
});

describe('backup reconciliation', () => {
  it('does not dedup against a dangling latest_backup pointer', async () => {
    await SpaceService.createSpace('Dangling');
    const r = await BackupService.createBackup('dangling', JSON.stringify([{ id: '1' }]));
    const filename = (r as any).filename;
    rmSync(join(process.env.DATA_DIR!, 'spaces', 'dangling', 'backups', filename));

    const again = await BackupService.createBackup('dangling', JSON.stringify([{ id: '1' }]));
    expect(again.success).toBe(true);
    expect((again as any).deduplicated).toBeFalsy();
  });

  it('delete reconciles latest_backup + version to the previous file', async () => {
    await SpaceService.createSpace('Recon');
    const oldFile = seedBackupFile('recon', Date.now() - 60_000, [{ id: 'old' }], 'aaaa1111');
    const newFile = seedBackupFile('recon', Date.now(), [{ id: 'new' }], 'bbbb2222');

    BackupRepo.backfillSceneVersions();
    let space = SpaceRepo.getSpaceBySubdomain('recon')!;
    expect(space.latest_backup).toBe(newFile);
    expect(space.scene_version).toBe(sceneFingerprint([{ id: 'new' }]));

    BackupRepo.deleteBackup('recon', newFile);
    space = SpaceRepo.getSpaceBySubdomain('recon')!;
    expect(space.latest_backup).toBe(oldFile);
    expect(space.scene_version).toBe(sceneFingerprint([{ id: 'old' }]));
  });

  it('delete of the last backup clears latest_backup + version', async () => {
    await SpaceService.createSpace('Empty');
    const only = seedBackupFile('empty', Date.now(), [{ id: 'only' }], 'cccc3333');
    BackupRepo.backfillSceneVersions();

    BackupRepo.deleteBackup('empty', only);
    const space = SpaceRepo.getSpaceBySubdomain('empty')!;
    expect(space.latest_backup).toBeNull();
    expect(space.scene_version).toBeNull();
  });

  it('backfill recomputes a missing version and repairs the pointer', async () => {
    await SpaceService.createSpace('Backfill');
    const filename = seedBackupFile('backfill', Date.now(), [{ id: 'bf' }], 'dddd4444');
    SpaceRepo.updateLatestBackup('backfill', null);
    SpaceRepo.updateSceneVersion('backfill', null, null);

    BackupRepo.backfillSceneVersions();
    const space = SpaceRepo.getSpaceBySubdomain('backfill')!;
    expect(space.latest_backup).toBe(filename);
    expect(space.scene_version).toBe(sceneFingerprint([{ id: 'bf' }]));
    expect(space.scene_version_source).toBe(filename);
  });
});
