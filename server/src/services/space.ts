import * as SpaceRepo from '~/repos/space.js';
import type { SpaceMeta } from '~/repos/space.js';

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'dashboard', 'login']);

const SUBDOMAIN_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  const subdomain = slugifyName(name);
  validateSubdomain(subdomain);
  return SpaceRepo.createSpace(name, subdomain);
}

export async function renameSpace(
  id: string,
  updates: { name?: string; subdomain?: string },
): Promise<SpaceMeta> {
  if (updates.subdomain) {
    validateSubdomain(updates.subdomain);
  }
  return SpaceRepo.updateSpaceMeta(id, updates);
}
