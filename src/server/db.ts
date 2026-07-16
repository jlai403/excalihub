import { drizzle } from 'drizzle-orm/sql-js';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { env } from '../env.js';
import * as schema from './schema.js';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let client: SqlJsDatabase;
let db: DrizzleDb;

export async function getDb(): Promise<DrizzleDb> {
  if (!db) {
    const SQL = await initSqlJs();

    const dir = dirname(env.DB_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(env.DB_PATH)) {
      const buffer = readFileSync(env.DB_PATH);
      client = new SQL.Database(buffer);
    } else {
      client = new SQL.Database();
    }

    initSchema();
    db = drizzle(client, { schema });
  }
  return db;
}

function initSchema() {
  client.run(`
    CREATE TABLE IF NOT EXISTS spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      subdomain TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER NOT NULL,
      file_data TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    );
  `);

  client.run(`
    CREATE INDEX IF NOT EXISTS idx_backups_space_id ON backups(space_id);
    CREATE INDEX IF NOT EXISTS idx_backups_hash ON backups(file_hash);
  `);

  saveDb();
}

export function saveDb() {
  const data = client.export();
  const buffer = Buffer.from(data);
  writeFileSync(env.DB_PATH, buffer);
}
