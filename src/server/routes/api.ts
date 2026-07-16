import { Hono } from 'hono';
import { createHash } from 'crypto';
import { getDb } from '../db.js';
import {
  createSpace,
  getAllSpaces,
  getSpaceById,
  getSpaceBySubdomain,
  deleteSpace,
} from '../repositories/space.js';
import {
  createBackup,
  getBackupsBySpaceId,
  getBackupById,
  getLatestBackupHash,
} from '../repositories/backup.js';

const api = new Hono();

// Ensure DB is initialized
api.use('*', async (c, next) => {
  await getDb();
  return next();
});

// List all spaces
api.get('/spaces', async (c) => {
  const spaces = await getAllSpaces();
  return c.json(spaces);
});

// Get single space
api.get('/spaces/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);
  return c.json(space);
});

// Create space
api.post('/spaces', async (c) => {
  const body = await c.req.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return c.json({ error: 'Name is required' }, 400);
  }

  const subdomain = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  try {
    const space = await createSpace(name, subdomain);
    return c.json(space, 201);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint') || err.message?.includes('unique')) {
      return c.json({ error: 'Space name already exists' }, 409);
    }
    throw err;
  }
});

// Delete space
api.delete('/spaces/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  await deleteSpace(id);
  return c.json({ success: true });
});

// List backups for space
api.get('/spaces/:id/backups', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = await getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const backups = await getBackupsBySpaceId(id);
  return c.json(backups);
});

// Receive backup from injected script
api.post('/backup', async (c) => {
  const body = await c.req.json();
  const { subdomain, elements, appState } = body;

  if (!subdomain || !elements) {
    return c.json({ error: 'Subdomain and elements required' }, 400);
  }

  const space = await getSpaceBySubdomain(subdomain);
  if (!space) {
    return c.json({ error: 'Space not found' }, 404);
  }

  const fileData = JSON.stringify({
    elements: JSON.parse(elements),
    appState: appState ? JSON.parse(appState) : {},
    files: {},
  });

  const fileHash = createHash('sha256').update(fileData).digest('hex');

  const latestHash = await getLatestBackupHash(space.id);
  if (latestHash === fileHash) {
    return c.json({ success: true, deduplicated: true });
  }

  const backup = await createBackup(space.id, fileData, fileHash);
  return c.json({ success: true, backupId: backup.id });
});

// Download backup
api.get('/backups/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const backup = await getBackupById(id);
  if (!backup) return c.json({ error: 'Backup not found' }, 404);

  return new Response(backup.fileData, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-${backup.id}.excalidraw"`,
    },
  });
});

export default api;
