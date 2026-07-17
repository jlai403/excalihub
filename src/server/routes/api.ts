import { Hono } from 'hono';
import { getDb } from '~/server/db.js';
import {
  createSpaceService,
  getAllSpacesService,
  getSpaceByIdService,
  deleteSpaceService,
} from '~/server/services/space.js';
import {
  createBackupService,
  getBackupsBySpaceIdService,
  getBackupByIdService,
} from '~/server/services/backup.js';

const api = new Hono();

api.use('*', async (c, next) => {
  await getDb();
  return next();
});

api.get('/spaces', async (c) => {
  const spaces = await getAllSpacesService();
  return c.json(spaces);
});

api.get('/spaces/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await getSpaceByIdService(id);
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
    const space = await createSpaceService(name);
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
  const space = await getSpaceByIdService(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  await deleteSpaceService(id);
  return c.json({ success: true });
});

api.get('/spaces/:id/backups', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await getSpaceByIdService(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const backups = await getBackupsBySpaceIdService(id);
  return c.json(backups);
});

api.post('/backup', async (c) => {
  const body = await c.req.json();
  const { subdomain, elements, appState } = body;

  if (!subdomain || !elements) {
    return c.json({ error: 'Subdomain and elements required' }, 400);
  }

  try {
    const result = await createBackupService(subdomain, elements, appState);
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
  const backup = await getBackupByIdService(id);
  if (!backup) return c.json({ error: 'Backup not found' }, 404);

  return new Response(backup.fileData, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-${backup.id}.excalidraw"`,
    },
  });
});

export default api;
