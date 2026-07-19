import { createHash } from 'crypto';
import * as BackupRepo from '~/server/repos/backup.js';
import * as SpaceRepo from '~/server/repos/space.js';

export type CreateBackupResult =
  { success: true; filename: string } | { success: true; deduplicated: true };

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
  const space = SpaceRepo.getSpaceBySubdomain(subdomain);
  if (!space) {
    throw new Error('Space not found');
  }

  const fileData = buildFileData(elements, appState);
  const fileHash = hashFileData(fileData);

  const result = await BackupRepo.createBackup(subdomain, fileData, fileHash);
  if (result.deduplicated) {
    return { success: true, deduplicated: true };
  }
  return { success: true, filename: result.filename };
}
