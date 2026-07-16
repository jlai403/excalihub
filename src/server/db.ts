import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { env } from '../env.js';

let db: SqlJsDatabase;

export async function getDb(): Promise<SqlJsDatabase> {
  if (!db) {
    const SQL = await initSqlJs();

    const dir = dirname(env.DB_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(env.DB_PATH)) {
      const buffer = readFileSync(env.DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initSchema();
  }
  return db;
}

function initSchema() {
  db.run(`
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

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_backups_space_id ON backups(space_id);
    CREATE INDEX IF NOT EXISTS idx_backups_hash ON backups(file_hash);
  `);

  saveDb();
}

export function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(env.DB_PATH, buffer);
}

export interface Space {
  id: number;
  name: string;
  subdomain: string;
  created_at: string;
  updated_at: string;
}

export interface Backup {
  id: number;
  space_id: number;
  file_data: string;
  file_hash: string;
  created_at: string;
}

export function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql: string, params: any[] = []): any | undefined {
  const results = queryAll(sql, params);
  return results[0];
}

export function run(sql: string, params: any[] = []) {
  db.run(sql, params);
}
