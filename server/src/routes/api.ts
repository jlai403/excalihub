import { Hono } from 'hono';
import { env } from '~/env.js';
import * as SpaceRepo from '~/repos/space.js';
import * as BackupRepo from '~/repos/backup.js';
import * as SpaceService from '~/services/space.js';
import * as BackupService from '~/services/backup.js';

const api = new Hono();

api.get('/config', (c) => {
  return c.json({ hubHost: `${env.HUB_SUBDOMAIN}.${env.BASE_DOMAIN}` });
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

export default api;
