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

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const results = queryAll(sql, params);
  return results[0];
}

export function createSpace(name: string, subdomain: string): Space {
  db.run(
    'INSERT INTO spaces (name, subdomain) VALUES (?, ?)',
    [name, subdomain]
  );
  saveDb();
  return queryOne('SELECT * FROM spaces WHERE subdomain = ?', [subdomain]);
}

export function getSpaceBySubdomain(subdomain: string): Space | undefined {
  return queryOne('SELECT * FROM spaces WHERE subdomain = ?', [subdomain]);
}

export function getSpaceById(id: number): Space | undefined {
  return queryOne('SELECT * FROM spaces WHERE id = ?', [id]);
}

export function getAllSpaces(): Space[] {
  return queryAll('SELECT * FROM spaces ORDER BY created_at DESC');
}

export function deleteSpace(id: number): void {
  db.run('DELETE FROM spaces WHERE id = ?', [id]);
  saveDb();
}

export function createBackup(spaceId: number, fileData: string, fileHash: string): Backup {
  db.run(
    'INSERT INTO backups (space_id, file_data, file_hash) VALUES (?, ?, ?)',
    [spaceId, fileData, fileHash]
  );
  saveDb();
  return queryOne('SELECT * FROM backups WHERE space_id = ? ORDER BY id DESC LIMIT 1', [spaceId]);
}

export function getBackupsBySpaceId(spaceId: number): Backup[] {
  return queryAll(
    'SELECT id, space_id, file_hash, created_at FROM backups WHERE space_id = ? ORDER BY created_at DESC',
    [spaceId]
  );
}

export function getBackupById(id: number): Backup | undefined {
  return queryOne('SELECT * FROM backups WHERE id = ?', [id]);
}

export function getLatestBackupHash(spaceId: number): string | undefined {
  const result = queryOne(
    'SELECT file_hash FROM backups WHERE space_id = ? ORDER BY created_at DESC LIMIT 1',
    [spaceId]
  );
  return result?.file_hash;
}
