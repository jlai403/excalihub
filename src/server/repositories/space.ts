import { eq } from 'drizzle-orm';
import { getDb, saveDb } from '../db.js';
import { spaces } from '../schema.js';
import type { InferSelectModel } from 'drizzle-orm';

export type Space = InferSelectModel<typeof spaces>;

export async function createSpace(name: string, subdomain: string): Promise<Space> {
  const db = await getDb();
  const result = db.insert(spaces).values({ name, subdomain }).returning().get();
  saveDb();
  return result;
}

export async function getSpaceBySubdomain(subdomain: string): Promise<Space | undefined> {
  const db = await getDb();
  return db.select().from(spaces).where(eq(spaces.subdomain, subdomain)).get();
}

export async function getSpaceById(id: number): Promise<Space | undefined> {
  const db = await getDb();
  return db.select().from(spaces).where(eq(spaces.id, id)).get();
}

export async function getAllSpaces(): Promise<Space[]> {
  const db = await getDb();
  return db.select().from(spaces).orderBy(spaces.createdAt).all();
}

export async function deleteSpace(id: number): Promise<void> {
  const db = await getDb();
  db.delete(spaces).where(eq(spaces.id, id)).run();
  saveDb();
}
