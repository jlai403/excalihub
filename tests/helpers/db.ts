import { vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';

let testDbPath: string;
let testDbDir: string;
let moduleExports: any;

export async function createTestDb() {
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  testDbDir = join(tmpdir(), `excalihub-test-${testId}`);
  testDbPath = join(testDbDir, 'test.db');

  process.env.DB_PATH = testDbPath;

  vi.resetModules();

  const dbModule = await import('../../src/server/db.js');
  const spaceRepo = await import('../../src/server/repositories/space.js');
  const backupRepo = await import('../../src/server/repositories/backup.js');

  await dbModule.getDb();

  moduleExports = {
    ...dbModule,
    ...spaceRepo,
    ...backupRepo,
  };

  return moduleExports;
}

export function cleanupTestDb() {
  if (testDbDir && existsSync(testDbDir)) {
    rmSync(testDbDir, { recursive: true, force: true });
  }
  delete process.env.DB_PATH;
}
