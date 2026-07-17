import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';

let testDbDir: string;

export function setupTestDb(): string {
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  testDbDir = join(tmpdir(), `excalihub-test-${testId}`);
  const dbPath = join(testDbDir, 'test.db');
  process.env.DB_PATH = dbPath;
  return dbPath;
}

export function cleanupTestDb() {
  if (testDbDir && existsSync(testDbDir)) {
    rmSync(testDbDir, { recursive: true, force: true });
  }
  delete process.env.DB_PATH;
}
