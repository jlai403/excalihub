import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { updateLatestBackup, getSpaceBySubdomain } from './space.js'

const NANOID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function nanoid(size = 8): string {
  const bytes = randomBytes(size)
  let result = ''
  for (let i = 0; i < size; i++) {
    result += NANOID_ALPHABET[bytes[i] % NANOID_ALPHABET.length]
  }
  return result
}

let dataDir = './data'

class Mutex {
  private queue: (() => void)[] = []
  private locked = false

  acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true
      return Promise.resolve(() => this.release())
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.locked = true
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.locked = false
    const next = this.queue.shift()
    if (next) next()
  }
}

const locks = new Map<string, Mutex>()

function getLock(subdomain: string): Mutex {
  if (!locks.has(subdomain)) {
    locks.set(subdomain, new Mutex())
  }
  return locks.get(subdomain)!
}

function spaceDir(subdomain: string): string {
  return join(dataDir, 'spaces', subdomain)
}

function backupsDir(subdomain: string): string {
  return join(spaceDir(subdomain), 'backups')
}

const backupIndex = new Map<string, string>()

function parseFilename(filename: string): { nanoid: string; unixTs: number; hashPrefix: string } | null {
  const match = filename.match(/^([a-z0-9]+)-(\d+)-([a-f0-9]+)\.excalidraw$/)
  if (!match) return null
  return { nanoid: match[1], unixTs: parseInt(match[2]), hashPrefix: match[3] }
}

function buildFilename(unixTs: number, hash: string): string {
  return `${nanoid()}-${unixTs}-${hash.slice(0, 8)}.excalidraw`
}

function hashPrefix(filename: string): string | null {
  return parseFilename(filename)?.hashPrefix ?? null
}

export function resetBackups(): void {
  backupIndex.clear()
  locks.clear()
}

export function initBackups(dir: string): void {
  dataDir = dir
  backupIndex.clear()
  locks.clear()

  const root = join(dataDir, 'spaces')
  if (!existsSync(root)) return

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const bkDir = join(root, entry.name, 'backups')
    if (!existsSync(bkDir)) continue
    for (const file of readdirSync(bkDir)) {
      const parsed = parseFilename(file)
      if (parsed) {
        backupIndex.set(parsed.nanoid, entry.name)
      }
    }
  }
}

export async function createBackup(
  subdomain: string,
  fileData: string,
  fileHash: string,
): Promise<{ filename: string; deduplicated?: boolean }> {
  const lock = getLock(subdomain)
  const release = await lock.acquire()
  try {
    const space = getSpaceBySubdomain(subdomain)
    if (!space) throw new Error('Space not found')

    if (space.latest_backup) {
      const prefix = hashPrefix(space.latest_backup)
      if (prefix && fileHash.startsWith(prefix)) {
        return { filename: space.latest_backup, deduplicated: true }
      }
    }

    const now = Date.now()
    const filename = buildFilename(now, fileHash)
    const filePath = join(backupsDir(subdomain), filename)

    writeFileSync(filePath, fileData, 'utf-8')
    updateLatestBackup(subdomain, filename)
    const parsed = parseFilename(filename)
    if (parsed) backupIndex.set(parsed.nanoid, subdomain)

    return { filename }
  } finally {
    release()
  }
}

export function getBackupsBySpaceId(subdomain: string): Array<{
  filename: string
  hash: string
  createdAt: string
}> {
  const dir = backupsDir(subdomain)
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter(f => f.endsWith('.excalidraw'))
    .sort()
    .reverse()
    .map(filename => {
      const parsed = parseFilename(filename)
      return {
        filename,
        hash: parsed?.hashPrefix ?? '',
        createdAt: parsed ? new Date(parsed.unixTs).toISOString() : '',
      }
    })
}

export function getBackupById(filename: string): { subdomain: string; data: string } | null {
  const parsed = parseFilename(filename)
  if (!parsed) return null
  const subdomain = backupIndex.get(parsed.nanoid)
  if (!subdomain) return null
  const filePath = join(backupsDir(subdomain), filename)
  if (!existsSync(filePath)) return null
  return { subdomain, data: readFileSync(filePath, 'utf-8') }
}

export function getLatestBackupHash(subdomain: string): string | null {
  const space = getSpaceBySubdomain(subdomain)
  if (!space?.latest_backup) return null
  return hashPrefix(space.latest_backup)
}
