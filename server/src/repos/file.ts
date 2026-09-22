import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

let dataDir = './data';

function filesDir(subdomain: string): string {
  return join(dataDir, 'spaces', subdomain, 'files');
}

export function initFiles(dir: string): void {
  dataDir = dir;
}

export function saveFile(subdomain: string, fileId: string, data: unknown): void {
  const dir = filesDir(subdomain);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${fileId}.json`), JSON.stringify(data));
}

export function getFile(subdomain: string, fileId: string): unknown | null {
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
  return existsSync(join(filesDir(subdomain), `${fileId}.json`));
}
