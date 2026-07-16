import { queryAll, queryOne, run, saveDb } from '../db.js';
import type { Space } from '../db.js';

export function createSpace(name: string, subdomain: string): Space {
  run('INSERT INTO spaces (name, subdomain) VALUES (?, ?)', [name, subdomain]);
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
  run('DELETE FROM spaces WHERE id = ?', [id]);
  saveDb();
}
