import {
  mkdirSync,
  writeFileSync,
  renameSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from 'fs';
import { join } from 'path';
import { spaceId as nanoid } from './nanoid.js';
import { removeBackupsBySubdomain } from './backup.js';

export type SpaceStatus = 'active' | 'archived';

export type SpaceMeta = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  updatedAt: string;
  latest_backup: string | null;
  status: SpaceStatus;
};

let dataDir = './data';
const index = new Map<string, SpaceMeta>();

function spaceDir(subdomain: string): string {
  return join(dataDir, 'spaces', subdomain);
}

function metaPath(subdomain: string): string {
  return join(spaceDir(subdomain), 'meta.json');
}

function writeMetaAtomic(meta: SpaceMeta): void {
  const tmp = metaPath(meta.subdomain) + '.tmp';
  writeFileSync(tmp, JSON.stringify(meta, null, 2) + '\n');
  renameSync(tmp, metaPath(meta.subdomain));
}

export function initSpaces(dir: string): void {
  dataDir = dir;
  const root = join(dataDir, 'spaces');
  if (!existsSync(root)) return;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mp = join(root, entry.name, 'meta.json');
    if (!existsSync(mp)) continue;
    try {
      const meta: SpaceMeta = JSON.parse(readFileSync(mp, 'utf-8'));
      if (!meta.status) meta.status = 'active';
      index.set(meta.subdomain, meta);
    } catch {
      // skip corrupted meta.json
    }
  }
}

export function resetSpaces(): void {
  index.clear();
}

export function createSpace(name: string, subdomain: string): SpaceMeta {
  if (index.has(subdomain)) {
    throw new Error(`Space with subdomain "${subdomain}" already exists`);
  }
  for (const s of index.values()) {
    if (s.name === name) {
      throw new Error(`Space with name "${name}" already exists`);
    }
  }

  const now = new Date().toISOString();
  const space: SpaceMeta = {
    id: nanoid(),
    name,
    subdomain,
    createdAt: now,
    updatedAt: now,
    latest_backup: null,
    status: 'active',
  };

  const dir = spaceDir(subdomain);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'backups'), { recursive: true });
  writeMetaAtomic(space);
  index.set(subdomain, space);

  return space;
}

export function getSpaceBySubdomain(subdomain: string): SpaceMeta | undefined {
  return index.get(subdomain);
}

export function getSpaceById(id: string): SpaceMeta | undefined {
  for (const space of index.values()) {
    if (space.id === id) return space;
  }
  return undefined;
}

export function getAllSpaces(): SpaceMeta[] {
  return [...index.values()];
}

export function getAllSpacesByStatus(status: SpaceStatus): SpaceMeta[] {
  return [...index.values()].filter((s) => s.status === status);
}

export function archiveSpace(id: string): SpaceMeta {
  const space = getSpaceById(id);
  if (!space) throw new Error('Space not found');
  space.status = 'archived';
  space.updatedAt = new Date().toISOString();
  writeMetaAtomic(space);
  return space;
}

export function unarchiveSpace(id: string): SpaceMeta {
  const space = getSpaceById(id);
  if (!space) throw new Error('Space not found');
  space.status = 'active';
  space.updatedAt = new Date().toISOString();
  writeMetaAtomic(space);
  return space;
}

export function deleteSpace(id: string): void {
  const space = getSpaceById(id);
  if (!space) return;

  rmSync(spaceDir(space.subdomain), { recursive: true, force: true });
  removeBackupsBySubdomain(space.subdomain);
  index.delete(space.subdomain);
}

export function updateSpaceMeta(
  id: string,
  updates: { name?: string; subdomain?: string; status?: SpaceStatus },
): SpaceMeta {
  const space = getSpaceById(id);
  if (!space) throw new Error('Space not found');

  const newSubdomain = updates.subdomain ?? space.subdomain;
  const newName = updates.name ?? space.name;

  if (newSubdomain !== space.subdomain) {
    if (index.has(newSubdomain)) {
      throw new Error(`Subdomain "${newSubdomain}" is already taken`);
    }
  }

  const updated: SpaceMeta = {
    ...space,
    name: newName,
    subdomain: newSubdomain,
    status: updates.status ?? space.status,
    updatedAt: new Date().toISOString(),
  };

  if (newSubdomain !== space.subdomain) {
    // Directory rename affects proxy routing / DNS — the old subdomain's hostname
    // will no longer resolve to this space's Excalidraw instance. The DNS record
    // for the old subdomain must be updated or removed separately.
    renameSync(spaceDir(space.subdomain), spaceDir(newSubdomain));
    index.delete(space.subdomain);
  }

  writeMetaAtomic(updated);
  index.set(updated.subdomain, updated);

  return updated;
}

export function updateLatestBackup(subdomain: string, filename: string): void {
  const space = index.get(subdomain);
  if (!space) return;
  space.latest_backup = filename;
  writeMetaAtomic(space);
}

export function getLatestBackupHash(subdomain: string): string | null {
  const space = index.get(subdomain);
  if (!space?.latest_backup) return null;
  const match = space.latest_backup.match(/-([a-f0-9]+)\.excalidraw$/);
  return match ? match[1] : null;
}
