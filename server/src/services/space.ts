import * as SpaceRepo from '~/repos/space.js';
import type { SpaceMeta, SpaceStatus } from '~/repos/space.js';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'dashboard', 'login', 'backup']);

const SUBDOMAIN_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MAX_NAME_LENGTH = 100;

function validateName(name: unknown): void {
  if (typeof name !== 'string') {
    throw new Error('Name must be a string');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
}

function validateSubdomain(subdomain: string): void {
  if (subdomain.length < 1) {
    throw new Error('Subdomain cannot be empty');
  }
  if (!SUBDOMAIN_RE.test(subdomain)) {
    throw new Error(
      'Subdomain must be lowercase alphanumeric with hyphens (e.g. "my-project")',
    );
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    throw new Error(`Subdomain "${subdomain}" is reserved`);
  }
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createSpace(name: string): Promise<SpaceMeta> {
  validateName(name);
  const subdomain = slugifyName(name);
  validateSubdomain(subdomain);
  return SpaceRepo.createSpace(name, subdomain);
}

export async function renameSpace(
  id: string,
  updates: { name?: string; subdomain?: string; status?: SpaceStatus },
): Promise<SpaceMeta> {
  if (updates.name !== undefined) {
    validateName(updates.name);
  }
  if (updates.subdomain) {
    validateSubdomain(updates.subdomain);
  }
  if (updates.status && !['active', 'archived'].includes(updates.status)) {
    throw new Error('Status must be "active" or "archived"');
  }
  return SpaceRepo.updateSpaceMeta(id, updates);
}
