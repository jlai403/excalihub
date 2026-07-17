import * as SpaceRepo from '~/server/repositories/space.js';
import type { Space } from '~/server/repositories/space.js';

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createSpace(name: string): Promise<Space> {
  const subdomain = slugifyName(name);
  return SpaceRepo.createSpace(name, subdomain);
}

export async function getAllSpaces(): Promise<Space[]> {
  return SpaceRepo.getAllSpaces();
}

export async function getSpaceById(id: number): Promise<Space | undefined> {
  return SpaceRepo.getSpaceById(id);
}

export async function getSpaceBySubdomain(subdomain: string): Promise<Space | undefined> {
  return SpaceRepo.getSpaceBySubdomain(subdomain);
}

export async function deleteSpace(id: number): Promise<void> {
  return SpaceRepo.deleteSpace(id);
}
