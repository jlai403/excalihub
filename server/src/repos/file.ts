import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

let dataDir = './data';

export const FILE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function filesDir(subdomain: string): string {
  return join(dataDir, 'spaces', subdomain, 'files');
}

export function initFiles(dir: string): void {
  dataDir = dir;
}

export function saveFile(subdomain: string, fileId: string, data: unknown): void {
  if (!FILE_ID.test(fileId)) return;
  const dir = filesDir(subdomain);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${fileId}.json`), JSON.stringify(data));
}

export function getFile(subdomain: string, fileId: string): unknown | null {
  if (!FILE_ID.test(fileId)) return null;
  const path = join(filesDir(subdomain), `${fileId}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function getFiles(
  subdomain: string,
  fileIds: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of fileIds) {
    const file = getFile(subdomain, id);
    if (file) out[id] = file;
  }
  return out;
}

export function hasFile(subdomain: string, fileId: string): boolean {
  if (!FILE_ID.test(fileId)) return false;
  return existsSync(join(filesDir(subdomain), `${fileId}.json`));
}
