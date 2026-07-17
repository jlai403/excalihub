import { Hono } from 'hono';
import { getDb } from '~/server/db.js';
import * as SpaceService from '~/server/services/space.js';
import * as BackupService from '~/server/services/backup.js';

const api = new Hono();

api.use('*', async (c, next) => {
  await getDb();
  return next();
});

api.get('/spaces', async (c) => {
  const spaces = await SpaceService.getAllSpaces();
  return c.json(spaces);
});

api.get('/spaces/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await SpaceService.getSpaceById(id);
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
    if (err.message?.includes('UNIQUE constraint') || err.message?.includes('unique')) {
      return c.json({ error: 'Space name already exists' }, 409);
    }
    throw err;
  }
});

api.delete('/spaces/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await SpaceService.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  await SpaceService.deleteSpace(id);
  return c.json({ success: true });
});

api.get('/spaces/:id/backups', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await SpaceService.getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const backups = await BackupService.getBackupsBySpaceId(id);
  return c.json(backups);
});

api.post('/backup', async (c) => {
  const body = await c.req.json();
  const { subdomain, elements, appState } = body;

  if (!subdomain || !elements) {
    return c.json({ error: 'Subdomain and elements required' }, 400);
  }

  try {
    const result = await BackupService.createBackup(subdomain, elements, appState);
    return c.json(result);
  } catch (err: any) {
    if (err.message === 'Space not found') {
      return c.json({ error: 'Space not found' }, 404);
    }
    throw err;
  }
});

api.get('/backups/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const backup = await BackupService.getBackupById(id);
  if (!backup) return c.json({ error: 'Backup not found' }, 404);

  return new Response(backup.fileData, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-${backup.id}.excalidraw"`,
    },
  });
});

export default api;
