import {
  createSpace,
  getAllSpaces,
  getSpaceById,
  getSpaceBySubdomain,
  deleteSpace,
} from '~/server/repositories/space.js';
import type { Space } from '~/server/repositories/space.js';

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createSpaceService(name: string): Promise<Space> {
  const subdomain = slugifyName(name);
  return createSpace(name, subdomain);
}

export async function getAllSpacesService(): Promise<Space[]> {
  return getAllSpaces();
}

export async function getSpaceByIdService(id: number): Promise<Space | undefined> {
  return getSpaceById(id);
}

export async function getSpaceBySubdomainService(subdomain: string): Promise<Space | undefined> {
  return getSpaceBySubdomain(subdomain);
}

export async function deleteSpaceService(id: number): Promise<void> {
  return deleteSpace(id);
}
