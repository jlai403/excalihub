import { Hono } from 'hono';
import { env, envSchema } from '~/env.js';
import * as SpaceRepo from '~/repos/space.js';
import * as BackupRepo from '~/repos/backup.js';
import * as GitRepo from '~/repos/git.js';
import * as SpaceService from '~/services/space.js';
import * as BackupService from '~/services/backup.js';
import {
  connectGitRepo,
  commitAndPush,
  disconnectGitRepo,
  getSpaceGitStatus,
} from '~/services/git.js';

const api = new Hono();

api.get('/config', (c) => {
  const e = envSchema.parse(process.env);
  const hubHost = e.HUB_SUBDOMAIN
    ? `${e.HUB_SUBDOMAIN}.${e.BASE_DOMAIN}`
    : e.BASE_DOMAIN;
  return c.json({ hubHost });
});

api.get('/spaces', async (c) => {
  const spaces = SpaceRepo.getAllSpaces();
  return c.json(spaces);
});

api.get('/spaces/:id', async (c) => {
  const id = c.req.param('id');
  const space = SpaceRepo.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);
  return c.json(space);
});

api.post('/spaces', async (c) => {
  const body = await c.req.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return c.json({ error: 'Name is required' }, 400);
  }

  try {
    const space = await SpaceService.createSpace(name);
    return c.json(space, 201);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      return c.json({ error: 'Space name already exists' }, 409);
    }
    if (err.message?.includes('Subdomain')) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});

api.patch('/spaces/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  try {
    const space = await SpaceService.renameSpace(id, body);
    return c.json(space);
  } catch (err: any) {
    if (err.message === 'Space not found') {
      return c.json({ error: 'Space not found' }, 404);
    }
    if (
      err.message?.includes('Subdomain') ||
      err.message?.includes('is already taken')
    ) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});

api.delete('/spaces/:id', async (c) => {
  const id = c.req.param('id');
  const space = SpaceRepo.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  SpaceRepo.deleteSpace(id);
  return c.json({ success: true });
});

api.get('/spaces/:id/backups', async (c) => {
  const id = c.req.param('id');
  const space = SpaceRepo.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const backups = BackupRepo.getBackupsBySpaceId(space.subdomain);
  return c.json(backups);
});

api.get('/spaces/:id/git-status', async (c) => {
  const id = c.req.param('id');
  const space = SpaceRepo.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const status = await getSpaceGitStatus(space.subdomain);
  return c.json(status);
});

api.post('/backup', async (c) => {
  const body = await c.req.json();
  const { subdomain, elements, appState } = body;

  if (!subdomain || !elements) {
    return c.json({ error: 'Subdomain and elements required' }, 400);
  }

  try {
    const result = await BackupService.createBackup(
      subdomain,
      elements,
      appState,
    );
    return c.json(result);
  } catch (err: any) {
    if (err.message === 'Space not found') {
      return c.json({ error: 'Space not found' }, 404);
    }
    if (err.message?.startsWith('Invalid backup data')) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});

api.delete('/spaces/:id/backups/:filename', async (c) => {
  const id = c.req.param('id');
  const filename = c.req.param('filename');
  const space = SpaceRepo.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const deleted = BackupRepo.deleteBackup(space.subdomain, filename);
  if (!deleted) return c.json({ error: 'Backup not found' }, 404);

  return c.json({ success: true });
});

api.get('/backups/:filename', async (c) => {
  const filename = c.req.param('filename');
  const backup = BackupRepo.getBackupById(filename);
  if (!backup) return c.json({ error: 'Backup not found' }, 404);

  return new Response(backup.data, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

api.get('/git/config', (c) => {
  const config = GitRepo.getGitConfig();
  if (!config) {
    return c.json({ repoUrl: '', connected: false, connectedAt: null });
  }
  return c.json(config);
});

api.get('/git/ssh-key', (c) => {
  if (!GitRepo.isSSHKeyPairGenerated()) {
    GitRepo.generateSSHKeyPair();
  }
  const publicKey = GitRepo.getSSHPublicKey();
  return c.json({ publicKey });
});

api.post('/git/connect', async (c) => {
  const body = await c.req.json();
  const { repoUrl } = body;

  if (!repoUrl || typeof repoUrl !== 'string') {
    return c.json({ error: 'Repository URL is required' }, 400);
  }

  const result = await connectGitRepo(repoUrl);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true });
});

api.post('/git/commit', async (c) => {
  const body = await c.req.json();
  const { subdomain, excalidrawData, pngBase64, message } = body;

  if (!subdomain || !excalidrawData || !message) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const result = await commitAndPush(
    subdomain,
    excalidrawData,
    pngBase64,
    message
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true });
});

api.post('/git/disconnect', async (c) => {
  await disconnectGitRepo();
  return c.json({ success: true });
});

export default api;
