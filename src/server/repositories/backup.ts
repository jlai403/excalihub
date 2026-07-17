import { eq, desc } from 'drizzle-orm';
import { getDb, saveDb } from '~/server/db.js';
import { backups } from '~/server/schema.js';
import type { InferSelectModel } from 'drizzle-orm';

export type Backup = InferSelectModel<typeof backups>;

export async function createBackup(spaceId: number, fileData: string, fileHash: string): Promise<Backup> {
  const db = await getDb();
  const result = db.insert(backups).values({ spaceId, fileData, fileHash }).returning().get();
  saveDb();
  return result;
}

export async function getBackupsBySpaceId(spaceId: number): Promise<Backup[]> {
  const db = await getDb();
  return db.select({
    id: backups.id,
    spaceId: backups.spaceId,
    fileHash: backups.fileHash,
    createdAt: backups.createdAt,
  }).from(backups).where(eq(backups.spaceId, spaceId)).orderBy(desc(backups.createdAt)).all();
}

export async function getBackupById(id: number): Promise<Backup | undefined> {
  const db = await getDb();
  return db.select().from(backups).where(eq(backups.id, id)).get();
}

export async function getLatestBackupHash(spaceId: number): Promise<string | undefined> {
  const db = await getDb();
  const result = db.select({ fileHash: backups.fileHash })
    .from(backups)
    .where(eq(backups.spaceId, spaceId))
    .orderBy(desc(backups.createdAt))
    .limit(1)
    .get();
  return result?.fileHash;
}
