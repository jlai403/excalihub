import { existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { initSpaces } from './space.js';
import { initBackups } from './backup.js';
import { initGitConfig } from './git.js';

export function initRepos(dataDir: string): void {
  dataDir = resolve(dataDir);
  const spacesDir = join(dataDir, 'spaces');
  if (!existsSync(spacesDir)) {
    mkdirSync(spacesDir, { recursive: true });
  }
  initSpaces(dataDir);
  initBackups(dataDir);
  initGitConfig(dataDir);
}

export * from './space.js';
export * from './backup.js';
export * from './git.js';
