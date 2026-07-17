import type { Hono } from 'hono';
import { createApiHelper, type ApiHelper } from '../helpers/request.js';
import type { Space } from '../../src/server/repositories/space.js';
import type { Backup } from '../../src/server/repositories/backup.js';

export async function createSpaceFixture(app: Hono) {
  const api = createApiHelper(app);
  const spaces: Space[] = [];
  const backups: Backup[] = [];

  return {
    async addSpace(name: string) {
      const res = await api.post('/api/spaces', { name });
      const space: Space = await api.json(res);
      spaces.push(space);
      return this;
    },

    async addBackup(spaceName: string, data: { elements: string; appState?: string | null }) {
      const space = spaces.find(s => s.name === spaceName);
      if (!space) throw new Error(`Space "${spaceName}" not found in fixture`);

      const res = await api.post('/api/backup', {
        subdomain: space.subdomain,
        elements: data.elements,
        appState: data.appState ?? null,
      });
      const result = await api.json(res);
      backups.push({ id: result.backupId, spaceId: space.id } as Backup);
      return this;
    },

    get spaces() { return spaces; },
    get spaceIds() { return spaces.map(s => s.id); },
    get backups() { return backups; },

    spaceByName(name: string) {
      return spaces.find(s => s.name === name);
    },
  };
}

export type SpaceFixture = Awaited<ReturnType<typeof createSpaceFixture>>;
