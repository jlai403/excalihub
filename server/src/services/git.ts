import simpleGit from 'simple-git';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { log } from '~/logger.js';
import {
  getGitConfig,
  setGitConfig,
  getSSHPrivateKey,
  getSSHPublicKey,
  generateSSHKeyPair,
  isSSHKeyPairGenerated,
  getDataDir,
} from '~/repos/git.js';

export async function connectGitRepo(
  repoUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!repoUrl || typeof repoUrl !== 'string') {
    return { success: false, error: 'Repository URL is required' };
  }

  if (!repoUrl.match(/^git@github\.com:[\w.-]+\/[\w.-]+\.git$/)) {
    return {
      success: false,
      error: 'Invalid repository URL. Expected format: git@github.com:user/repo.git',
    };
  }

  const dataDir = getDataDir();
  const spacesDir = join(dataDir, 'spaces');

  if (!isSSHKeyPairGenerated()) {
    try {
      generateSSHKeyPair();
      log.info('Generated SSH keypair for Git integration');
    } catch (err: any) {
      return { success: false, error: `Failed to generate SSH key: ${err.message}` };
    }
  }

  const sshKey = getSSHPrivateKey();
  if (!sshKey) {
    return { success: false, error: 'SSH private key not found' };
  }

  const sshDir = join(dataDir, 'git-config', '.ssh');
  if (!existsSync(sshDir)) {
    mkdirSync(sshDir, { recursive: true });
  }

  const sshConfigPath = join(sshDir, 'config');
  const sshConfig = `Host github.com
  HostName github.com
  User git
  IdentityFile ${join(dataDir, 'git-config', 'id_ed25519')}
  IdentitiesOnly yes
  StrictHostKeyChecking no
`;
  writeFileSync(sshConfigPath, sshConfig);

  try {
    const git = simpleGit({
      baseDir: spacesDir,
      unsafe: {
        allowUnsafeSshCommand: true,
      },
      config: [
        `core.sshCommand=ssh -F ${sshConfigPath}`,
        'user.name=ExcaliHub',
        'user.email=excalihub@localhost',
      ],
    });

    if (!existsSync(join(spacesDir, '.git'))) {
      log.info(`Initializing git repo with remote ${repoUrl}...`);
      await git.init(['-b', 'main']);
      await git.addRemote('origin', repoUrl);
    } else {
      log.info('Git repo already initialized, pulling latest...');
      await git.remote(['rm', 'origin']).catch(() => {});
      await git.addRemote('origin', repoUrl);
      try {
        await git.pull();
      } catch {
        log.info('No changes to pull');
      }
    }

    try {
      await git.raw(['ls-remote', 'origin', 'HEAD']);
    } catch (err: any) {
      return { success: false, error: `Cannot access remote repository. Make sure the deploy key is added with write access. (${err.message})` };
    }

    setGitConfig({
      repoUrl,
      connected: true,
      connectedAt: new Date().toISOString(),
    });

    log.info('Git repo connected successfully');
    return { success: true };
  } catch (err: any) {
    log.error('Git connect failed:', err);
    return { success: false, error: err.message };
  }
}

export async function commitAndPush(
  subdomain: string,
  excalidrawData: string,
  pngBase64: string | null,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const config = getGitConfig();
  if (!config?.connected) {
    return { success: false, error: 'Git not connected' };
  }

  const dataDir = getDataDir();
  const spacesDir = join(dataDir, 'spaces');
  const spaceDir = join(spacesDir, subdomain);

  if (!existsSync(spaceDir)) {
    return { success: false, error: `Space directory not found: ${subdomain}` };
  }

  try {
    const timestamp = Date.now();
    const excalidrawPath = join(spaceDir, `${subdomain}-${timestamp}.excalidraw`);
    writeFileSync(excalidrawPath, excalidrawData);

    if (pngBase64) {
      const pngPath = join(spaceDir, `${subdomain}-${timestamp}.png`);
      const pngBuffer = Buffer.from(pngBase64, 'base64');
      writeFileSync(pngPath, pngBuffer);
    }

    const sshDir = join(dataDir, 'git-config', '.ssh');
    const sshConfigPath = join(sshDir, 'config');

    const git = simpleGit({
      baseDir: spacesDir,
      unsafe: {
        allowUnsafeSshCommand: true,
      },
      config: [
        `core.sshCommand=ssh -F ${sshConfigPath}`,
        'user.name=ExcaliHub',
        'user.email=excalihub@localhost',
      ],
    });

    await git.add(`${subdomain}/`);
    await git.commit(message);
    await git.push('origin', 'main', { '-u': null });

    log.info(`Committed and pushed: ${message}`);
    return { success: true };
  } catch (err: any) {
    log.error('Git commit/push failed:', err);
    return { success: false, error: err.message };
  }
}

export async function disconnectGitRepo(): Promise<void> {
  setGitConfig({
    repoUrl: '',
    connected: false,
    connectedAt: null,
  });
  log.info('Git disconnected');
}
