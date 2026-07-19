import type { Hono } from 'hono'
import { createApiHelper, type ApiHelper } from '../helpers/request.js'
import type { SpaceMeta } from '../../src/server/repos/space.js'

export type BackupEntry = { filename: string }

export class SpaceFixture {
  private api: ApiHelper
  private _spaces: SpaceMeta[] = []
  private _backups: BackupEntry[] = []
  private _pendingOps: Array<() => Promise<void>> = []

  constructor(app: Hono) {
    this.api = createApiHelper(app)
  }

  addSpace(name: string): this {
    this._pendingOps.push(async () => {
      const res = await this.api.post('/api/spaces', { name })
      this._spaces.push(await this.api.json(res))
    })
    return this
  }

  addBackup(
    spaceName: string,
    data: { elements: string; appState?: string | null },
  ): this {
    this._pendingOps.push(async () => {
      const space = this._spaces.find((s) => s.name === spaceName)
      if (!space) throw new Error(`Space "${spaceName}" not found in fixture`)

      const res = await this.api.post('/api/backup', {
        subdomain: space.subdomain,
        elements: data.elements,
        appState: data.appState ?? null,
      })
      const result = await this.api.json(res)
      this._backups.push({ filename: result.filename })
    })
    return this
  }

  async execute(): Promise<this> {
    for (const op of this._pendingOps) {
      await op()
    }
    this._pendingOps = []
    return this
  }

  get spaces(): SpaceMeta[] {
    return this._spaces
  }
  get spaceIds(): string[] {
    return this._spaces.map((s) => s.id)
  }
  get backups(): BackupEntry[] {
    return this._backups
  }

  spaceByName(name: string): SpaceMeta | undefined {
    return this._spaces.find((s) => s.name === name)
  }
}
