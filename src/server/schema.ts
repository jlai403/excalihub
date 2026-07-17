import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const spaces = sqliteTable('spaces', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  subdomain: text().notNull().unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const backups = sqliteTable('backups', {
  id: integer().primaryKey({ autoIncrement: true }),
  spaceId: integer('space_id').notNull().references(() => spaces.id),
  fileData: text('file_data').notNull(),
  fileHash: text('file_hash').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
