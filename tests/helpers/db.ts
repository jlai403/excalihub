import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync, mkdtempSync } from 'fs';
import {
  initRepos,
  resetSpaces,
  resetBackups,
} from '../../src/server/repos/index.js';

let testDataDir: string;

export function setupTestDb(): string {
  testDataDir = mkdtempSync(join(tmpdir(), 'excalihub-test-'));
  process.env.DATA_DIR = testDataDir;
  initRepos(testDataDir);
  return testDataDir;
}

export function cleanupTestDb(): void {
  resetSpaces();
  resetBackups();
  if (testDataDir && existsSync(testDataDir)) {
    rmSync(testDataDir, { recursive: true, force: true });
  }
  delete process.env.DATA_DIR;
}
