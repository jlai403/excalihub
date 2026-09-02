import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { updateLatestBackup, getSpaceBySubdomain } from './space.js';
import { backupId as nanoid } from './nanoid.js';

let dataDir = './data';

class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve(() => this.release());
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) next();
  }
}

const locks = new Map<string, Mutex>();

function getLock(subdomain: string): Mutex {
  if (!locks.has(subdomain)) {
    locks.set(subdomain, new Mutex());
  }
  return locks.get(subdomain)!;
}

function spaceDir(subdomain: string): string {
  return join(dataDir, 'spaces', subdomain);
}

function backupsDir(subdomain: string): string {
  return join(spaceDir(subdomain), 'backups');
}

const backupIndex = new Map<string, string>();

function parseFilename(
  filename: string,
): { unixTs: number; nanoid: string; hashPrefix: string } | null {
  const match = filename.match(
    /^(\d+)-([a-z0-9]+)-([a-f0-9]+)\.excalidraw$/,
  );
  if (!match) return null;
  return {
    unixTs: parseInt(match[1]),
    nanoid: match[2],
    hashPrefix: match[3],
  };
}

function buildFilename(unixTs: number, hash: string): string {
  return `${unixTs}-${nanoid()}-${hash.slice(0, 8)}.excalidraw`;
}

function hashPrefix(filename: string): string | null {
  return parseFilename(filename)?.hashPrefix ?? null;
}

const ONE_DAY = 86_400_000;
const ONE_WEEK = 7 * ONE_DAY;
const FOUR_WEEKS = 4 * ONE_WEEK;
const TWELVE_MONTHS = 365 * ONE_DAY;

function cleanupOldBackups(subdomain: string): void {
  if (process.env.BACKUP_RETENTION_DISABLED) return;

  const dir = backupsDir(subdomain);
  if (!existsSync(dir)) return;

  const files: { filename: string; unixTs: number }[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.excalidraw')) continue;
    const parsed = parseFilename(f);
    if (parsed) files.push({ filename: f, unixTs: parsed.unixTs });
  }
  files.sort((a, b) => a.unixTs - b.unixTs);

  if (files.length === 0) return;

  const now = Date.now();
  const toKeep = new Set<string>();

  // Daily: latest per day for last 7 days
  const dailyCutoff = now - 7 * ONE_DAY;
  const dailyByDay = new Map<string, (typeof files)[0]>();
  for (const f of files) {
    if (f.unixTs >= dailyCutoff) {
      const day = new Date(f.unixTs).toISOString().slice(0, 10);
      const existing = dailyByDay.get(day);
      if (!existing || f.unixTs > existing.unixTs) {
        dailyByDay.set(day, f);
      }
    }
  }
  for (const f of dailyByDay.values()) toKeep.add(f.filename);

  // Weekly: latest per week for last 4 weeks (excluding last 7 days)
  const weeklyCutoff = now - FOUR_WEEKS;
  const weeklyByWeek = new Map<string, (typeof files)[0]>();
  for (const f of files) {
    if (f.unixTs >= weeklyCutoff && f.unixTs < dailyCutoff) {
      const d = new Date(f.unixTs);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const week = weekStart.toISOString().slice(0, 10);
      const existing = weeklyByWeek.get(week);
      if (!existing || f.unixTs > existing.unixTs) {
        weeklyByWeek.set(week, f);
      }
    }
  }
  for (const f of weeklyByWeek.values()) toKeep.add(f.filename);

  // Monthly: latest per month for last 12 months (excluding last 4 weeks)
  const monthlyCutoff = now - TWELVE_MONTHS;
  const monthlyByMonth = new Map<string, (typeof files)[0]>();
  for (const f of files) {
    if (f.unixTs >= monthlyCutoff && f.unixTs < weeklyCutoff) {
      const month = new Date(f.unixTs).toISOString().slice(0, 7);
      const existing = monthlyByMonth.get(month);
      if (!existing || f.unixTs > existing.unixTs) {
        monthlyByMonth.set(month, f);
      }
    }
  }
  for (const f of monthlyByMonth.values()) toKeep.add(f.filename);

  // Delete files not in any retention tier
  for (const f of files) {
    if (!toKeep.has(f.filename)) {
      unlinkSync(join(dir, f.filename));
    }
  }
}

export function resetBackups(): void {
  backupIndex.clear();
  locks.clear();
}

export function removeBackupsBySubdomain(subdomain: string): void {
  for (const [key, value] of backupIndex) {
    if (value === subdomain) backupIndex.delete(key);
  }
}

export function initBackups(dir: string): void {
  dataDir = dir;
  backupIndex.clear();
  locks.clear();

  const root = join(dataDir, 'spaces');
  if (!existsSync(root)) return;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const bkDir = join(root, entry.name, 'backups');
    if (!existsSync(bkDir)) continue;
    for (const file of readdirSync(bkDir)) {
      const parsed = parseFilename(file);
      if (parsed) {
        backupIndex.set(parsed.nanoid, entry.name);
      }
    }
  }
}

export async function createBackup(
  subdomain: string,
  fileData: string,
  fileHash: string,
): Promise<{ filename: string; deduplicated?: boolean }> {
  const lock = getLock(subdomain);
  const release = await lock.acquire();
  try {
    const space = getSpaceBySubdomain(subdomain);
    if (!space) throw new Error('Space not found');

    if (space.latest_backup) {
      const prefix = hashPrefix(space.latest_backup);
      if (prefix && fileHash.startsWith(prefix)) {
        return { filename: space.latest_backup, deduplicated: true };
      }
    }

    const now = Date.now();
    const filename = buildFilename(now, fileHash);
    const filePath = join(backupsDir(subdomain), filename);

    writeFileSync(filePath, fileData, 'utf-8');
    updateLatestBackup(subdomain, filename);
    const parsed = parseFilename(filename);
    if (parsed) backupIndex.set(parsed.nanoid, subdomain);

    cleanupOldBackups(subdomain);

    return { filename };
  } finally {
    release();
  }
}

export function deleteBackup(
  subdomain: string,
  filename: string,
): boolean {
  const parsed = parseFilename(filename);
  if (!parsed) return false;

  const filePath = join(backupsDir(subdomain), filename);
  if (!existsSync(filePath)) return false;

  unlinkSync(filePath);
  backupIndex.delete(parsed.nanoid);
  return true;
}

export function getBackupsBySpaceId(subdomain: string): Array<{
  filename: string;
  hash: string;
  createdAt: string;
}> {
  const dir = backupsDir(subdomain);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.excalidraw'))
    .sort()
    .reverse()
    .map((filename) => {
      const parsed = parseFilename(filename);
      return {
        filename,
        hash: parsed?.hashPrefix ?? '',
        createdAt: parsed ? new Date(parsed.unixTs).toISOString() : '',
      };
    });
}

export function getBackupById(
  filename: string,
): { subdomain: string; data: string } | null {
  const parsed = parseFilename(filename);
  if (!parsed) return null;
  const subdomain = backupIndex.get(parsed.nanoid);
  if (!subdomain) return null;
  const filePath = join(backupsDir(subdomain), filename);
  if (!existsSync(filePath)) return null;
  return { subdomain, data: readFileSync(filePath, 'utf-8') };
}
