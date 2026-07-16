import { queryAll, queryOne, run, saveDb } from '../db.js';
import type { Backup } from '../db.js';

export function createBackup(spaceId: number, fileData: string, fileHash: string): Backup {
  run(
    'INSERT INTO backups (space_id, file_data, file_hash) VALUES (?, ?, ?)',
    [spaceId, fileData, fileHash]
  );
  saveDb();
  return queryOne('SELECT * FROM backups WHERE space_id = ? ORDER BY id DESC LIMIT 1', [spaceId]);
}

export function getBackupsBySpaceId(spaceId: number): Backup[] {
  return queryAll(
    'SELECT id, space_id, file_hash, created_at FROM backups WHERE space_id = ? ORDER BY created_at DESC',
    [spaceId]
  );
}

export function getBackupById(id: number): Backup | undefined {
  return queryOne('SELECT * FROM backups WHERE id = ?', [id]);
}

export function getLatestBackupHash(spaceId: number): string | undefined {
  const result = queryOne(
    'SELECT file_hash FROM backups WHERE space_id = ? ORDER BY created_at DESC LIMIT 1',
    [spaceId]
  );
  return result?.file_hash;
}
