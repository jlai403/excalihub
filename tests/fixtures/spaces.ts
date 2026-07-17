import type { Hono } from 'hono';
import { createApiHelper, type ApiHelper } from '../helpers/request.js';
import type { Space } from '../../src/server/repositories/space.js';
import type { Backup } from '../../src/server/repositories/backup.js';

export class SpaceFixture {
  private api: ApiHelper;
  private _spaces: Space[] = [];
  private _backups: Backup[] = [];
  private _pendingOps: Array<() => Promise<void>> = [];

  constructor(app: Hono) {
    this.api = createApiHelper(app);
  }

  addSpace(name: string): this {
    this._pendingOps.push(async () => {
      const res = await this.api.post('/api/spaces', { name });
      this._spaces.push(await this.api.json(res));
    });
    return this;
  }

  addBackup(spaceName: string, data: { elements: string; appState?: string | null }): this {
    this._pendingOps.push(async () => {
      const space = this._spaces.find(s => s.name === spaceName);
      if (!space) throw new Error(`Space "${spaceName}" not found in fixture`);

      const res = await this.api.post('/api/backup', {
        subdomain: space.subdomain,
        elements: data.elements,
        appState: data.appState ?? null,
      });
      const result = await this.api.json(res);
      this._backups.push({ id: result.backupId, spaceId: space.id } as Backup);
    });
    return this;
  }

  async flush(): Promise<this> {
    for (const op of this._pendingOps) {
      await op();
    }
    this._pendingOps = [];
    return this;
  }

  get spaces(): Space[] { return this._spaces; }
  get spaceIds(): number[] { return this._spaces.map(s => s.id); }
  get backups(): Backup[] { return this._backups; }

  spaceByName(name: string): Space | undefined {
    return this._spaces.find(s => s.name === name);
  }
}
