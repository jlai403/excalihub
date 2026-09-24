import * as BackupRepo from '~/repos/backup.js';
import * as SpaceRepo from '~/repos/space.js';
import * as FileService from '~/services/file.js';
import { getCommittedScene } from '~/services/git.js';
import { sceneFingerprint } from '~/scene-fingerprint.js';

export type SceneSource = 'backup' | 'git';

export type Scene = {
  elements: unknown;
  appState: unknown;
  files: Record<string, unknown>;
  meta: {
    source: SceneSource;
    filename?: string;
    createdAt?: string;
    version: string | null;
  };
};

function createdAtFromFilename(filename: string): string | undefined {
  const match = filename.match(/^(\d+)-/);
  return match ? new Date(parseInt(match[1], 10)).toISOString() : undefined;
}

function sceneFromBackup(subdomain: string, filename: string): Scene | null {
  const backup = BackupRepo.getBackupById(filename);
  if (!backup || backup.subdomain !== subdomain) return null;

  const parsed = JSON.parse(backup.data);
  const elements = parsed?.elements ?? [];
  return {
    elements,
    appState: parsed?.appState ?? {},
    files: FileService.getFiles(subdomain, FileService.referencedFileIds(elements)),
    meta: {
      source: 'backup',
      filename,
      createdAt: createdAtFromFilename(filename),
      version: sceneFingerprint(elements),
    },
  };
}

async function sceneFromGit(subdomain: string): Promise<Scene | null> {
  const committed = await getCommittedScene(subdomain);
  if (!committed) return null;

  const elements = committed.elements ?? [];
  const embedded = committed.files ?? {};
  const missing = FileService.referencedFileIds(elements).filter((id) => !(id in embedded));
  return {
    elements,
    appState: committed.appState ?? {},
    files: { ...embedded, ...FileService.getFiles(subdomain, missing) },
    meta: { source: 'git', version: sceneFingerprint(elements) },
  };
}

export async function getScene(
  subdomain: string,
  options: { filename?: string; source?: string } = {},
): Promise<Scene | null> {
  if (!SpaceRepo.getSpaceBySubdomain(subdomain)) {
    throw new Error('Space not found');
  }

  if (options.source === 'git') {
    return sceneFromGit(subdomain);
  }
  if (options.filename) {
    return sceneFromBackup(subdomain, options.filename);
  }

  const latest = BackupRepo.getLatestBackupFilename(subdomain);
  return latest ? sceneFromBackup(subdomain, latest) : null;
}
