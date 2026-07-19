import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { initSpaces } from './space.js'
import { initBackups } from './backup.js'

export function initRepos(dataDir: string): void {
  const spacesDir = join(dataDir, 'spaces')
  if (!existsSync(spacesDir)) {
    mkdirSync(spacesDir, { recursive: true })
  }
  initSpaces(dataDir)
  initBackups(dataDir)
}

export * from './space.js'
export * from './backup.js'
