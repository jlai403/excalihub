import { createHash } from 'crypto';
import * as BackupRepo from '~/server/repositories/backup.js';
import * as SpaceRepo from '~/server/repositories/space.js';

export type CreateBackupResult =
  | { success: true; backupId: number }
  | { success: true; deduplicated: true };

function buildFileData(elements: string, appState?: string | null): string {
  let parsedElements: unknown;
  let parsedAppState: unknown;

  try {
    parsedElements = JSON.parse(elements);
  } catch {
    throw new Error('Invalid backup data: elements must be valid JSON');
  }

  if (appState) {
    try {
      parsedAppState = JSON.parse(appState);
    } catch {
      throw new Error('Invalid backup data: appState must be valid JSON');
    }
  } else {
    parsedAppState = {};
  }

  return JSON.stringify({
    elements: parsedElements,
    appState: parsedAppState,
    files: {},
  });
}

function hashFileData(fileData: string): string {
  return createHash('sha256').update(fileData).digest('hex');
}

export async function createBackup(
  subdomain: string,
  elements: string,
  appState?: string | null,
): Promise<CreateBackupResult> {
  const space = await SpaceRepo.getSpaceBySubdomain(subdomain);
  if (!space) {
    throw new Error('Space not found');
  }

  const fileData = buildFileData(elements, appState);
  const fileHash = hashFileData(fileData);

  const latestHash = await BackupRepo.getLatestBackupHash(space.id);
  if (latestHash === fileHash) {
    return { success: true, deduplicated: true };
  }

  const backup = await BackupRepo.createBackup(space.id, fileData, fileHash);
  return { success: true, backupId: backup.id };
}
