import * as SpaceRepo from '~/server/repositories/space.js';
import type { Space } from '~/server/repositories/space.js';

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createSpace(name: string): Promise<Space> {
  const subdomain = slugifyName(name);
  return SpaceRepo.createSpace(name, subdomain);
}
