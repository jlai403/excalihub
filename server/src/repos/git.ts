import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  readdirSync,
} from 'fs';
import { join } from 'path';

export type GitConfig = {
  repoUrl: string;
  connected: boolean;
  connectedAt: string | null;
};

let dataDir = './data';
let config: GitConfig | null = null;

function gitConfigDir(): string {
  return join(dataDir, 'git-config');
}

function configPath(): string {
  return join(gitConfigDir(), 'config.json');
}

function privateKeyPath(): string {
  return join(gitConfigDir(), 'id_ed25519');
}

function publicKeyPath(): string {
  return join(gitConfigDir(), 'id_ed25519.pub');
}

function writeConfigAtomic(cfg: GitConfig): void {
  const tmp = configPath() + '.tmp';
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n');
  renameSync(tmp, configPath());
}

export function initGitConfig(dir: string): void {
  dataDir = dir;
  config = null;
  const dirPath = gitConfigDir();

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    return;
  }

  const cp = configPath();
  if (existsSync(cp)) {
    try {
      config = JSON.parse(readFileSync(cp, 'utf-8'));
    } catch {
      config = null;
    }
  }
}

export function getGitConfig(): GitConfig | null {
  return config;
}

export function setGitConfig(cfg: GitConfig): void {
  config = cfg;
  writeConfigAtomic(cfg);
}

export function isSSHKeyPairGenerated(): boolean {
  return existsSync(privateKeyPath()) && existsSync(publicKeyPath());
}

export function getSSHPublicKey(): string | null {
  if (!existsSync(publicKeyPath())) return null;
  return readFileSync(publicKeyPath(), 'utf-8').trim();
}

export function getSSHPrivateKey(): string | null {
  if (!existsSync(privateKeyPath())) return null;
  return readFileSync(privateKeyPath(), 'utf-8');
}

export function generateSSHKeyPair(): string {
  const { execSync } = require('child_process');
  const dir = gitConfigDir();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  try {
    execSync(
      `ssh-keygen -t ed25519 -f "${privateKeyPath()}" -N "" -C "excalihub"`,
      { stdio: 'pipe' }
    );
  } catch (err: any) {
    throw new Error(
      'Failed to generate SSH key. The ssh-keygen binary is missing in this environment — ensure openssh-client is installed in the container.'
    );
  }

  chmodSync(privateKeyPath(), 0o600);

  return getSSHPublicKey()!;
}

export function resetGitConfig(): void {
  config = null;
  const dir = gitConfigDir();
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (file === '.git') continue;
      const filePath = join(dir, file);
      const { rmSync } = require('fs');
      rmSync(filePath, { recursive: true, force: true });
    }
  }
}

export function getDataDir(): string {
  return dataDir;
}
