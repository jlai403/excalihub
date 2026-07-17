import { createHash } from 'crypto';
import {
  createBackup,
  getBackupById,
  getBackupsBySpaceId,
  getLatestBackupHash,
} from '~/server/repositories/backup.js';
import type { Backup } from '~/server/repositories/backup.js';
import { getSpaceBySubdomainService } from './space.js';

export type CreateBackupResult =
  | { success: true; backupId: number }
  | { success: true; deduplicated: true };

export function buildFileData(elements: string, appState?: string | null): string {
  return JSON.stringify({
    elements: JSON.parse(elements),
    appState: appState ? JSON.parse(appState) : {},
    files: {},
  });
}

export function hashFileData(fileData: string): string {
  return createHash('sha256').update(fileData).digest('hex');
}

export async function createBackupService(
  subdomain: string,
  elements: string,
  appState?: string | null,
): Promise<CreateBackupResult> {
  const space = await getSpaceBySubdomainService(subdomain);
  if (!space) {
    throw new Error('Space not found');
  }

  const fileData = buildFileData(elements, appState);
  const fileHash = hashFileData(fileData);

  const latestHash = await getLatestBackupHash(space.id);
  if (latestHash === fileHash) {
    return { success: true, deduplicated: true };
  }

  const backup = await createBackup(space.id, fileData, fileHash);
  return { success: true, backupId: backup.id };
}

export async function getBackupsBySpaceIdService(spaceId: number): Promise<Backup[]> {
  return getBackupsBySpaceId(spaceId);
}

export async function getBackupByIdService(id: number): Promise<Backup | undefined> {
  return getBackupById(id);
}
