import * as FileRepo from '~/repos/file.js';
import * as SpaceRepo from '~/repos/space.js';

// base64 data URLs are ~1.33x the binary size; Excalidraw caps uploads at 4 MiB.
const MAX_FILE_CHARS = 8_000_000;
const MAX_FILES = 200;
const MAX_TOTAL_CHARS = 32_000_000;
const { FILE_ID } = FileRepo;

export function saveFiles(subdomain: string, files: unknown): number {
  const space = SpaceRepo.getSpaceBySubdomain(subdomain);
  if (!space) throw new Error('Space not found');
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('Invalid files payload');
  }

  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length > MAX_FILES) {
    throw new Error(`Too many files: ${entries.length} (max ${MAX_FILES})`);
  }

  let saved = 0;
  let totalChars = 0;
  for (const [fileId, value] of entries) {
    if (!FILE_ID.test(fileId)) {
      throw new Error(`Invalid file id: ${fileId}`);
    }
    if (!value || typeof value !== 'object') {
      throw new Error(`Invalid file: ${fileId}`);
    }
    const file = value as { id?: unknown; dataURL?: unknown; mimeType?: unknown };
    if (file.id !== fileId) {
      throw new Error(`File id mismatch: ${fileId}`);
    }
    if (typeof file.dataURL !== 'string' || typeof file.mimeType !== 'string') {
      throw new Error(`Invalid file data: ${fileId}`);
    }
    if (file.dataURL.length > MAX_FILE_CHARS) {
      throw new Error(`File too large: ${fileId}`);
    }
    totalChars += file.dataURL.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      throw new Error('Files payload too large');
    }
    FileRepo.saveFile(subdomain, fileId, value);
    saved++;
  }
  return saved;
}

export function getFiles(
  subdomain: string,
  fileIds: string[],
): Record<string, unknown> {
  return FileRepo.getFiles(subdomain, fileIds);
}

// Excalidraw image elements reference a binary via `fileId`.
export function referencedFileIds(elements: unknown): string[] {
  if (!Array.isArray(elements)) return [];
  const ids = new Set<string>();
  for (const element of elements) {
    if (
      element &&
      typeof element === 'object' &&
      typeof (element as { fileId?: unknown }).fileId === 'string'
    ) {
      ids.add((element as { fileId: string }).fileId);
    }
  }
  return [...ids];
}
