import { Hono } from 'hono';
import { createHash } from 'crypto';
import {
  getDb,
  createSpace,
  getAllSpaces,
  getSpaceById,
  getSpaceBySubdomain,
  deleteSpace,
  createBackup,
  getBackupsBySpaceId,
  getBackupById,
  getLatestBackupHash,
} from '../db.js';

const api = new Hono();

// Ensure DB is initialized
api.use('*', async (c, next) => {
  await getDb();
  return next();
});

// List all spaces
api.get('/spaces', async (c) => {
  const spaces = getAllSpaces();
  return c.json(spaces);
});

// Get single space
api.get('/spaces/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = getSpaceById(id);
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
    const space = createSpace(name, subdomain);
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
  const space = getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);
  
  deleteSpace(id);
  return c.json({ success: true });
});

// List backups for space
api.get('/spaces/:id/backups', async (c) => {
  const id = parseInt(c.req.param('id'));
  const space = getSpaceById(id);
  if (!space) return c.json({ error: 'Space not found' }, 404);
  
  const backups = getBackupsBySpaceId(id);
  return c.json(backups);
});

// Receive backup from injected script
api.post('/backup', async (c) => {
  const body = await c.req.json();
  const { subdomain, elements, appState } = body;
  
  if (!subdomain || !elements) {
    return c.json({ error: 'Subdomain and elements required' }, 400);
  }
  
  const space = getSpaceBySubdomain(subdomain);
  if (!space) {
    return c.json({ error: 'Space not found' }, 404);
  }
  
  const fileData = JSON.stringify({
    elements: JSON.parse(elements),
    appState: appState ? JSON.parse(appState) : {},
    files: {},
  });
  
  const fileHash = createHash('sha256').update(fileData).digest('hex');
  
  const latestHash = getLatestBackupHash(space.id);
  if (latestHash === fileHash) {
    return c.json({ success: true, deduplicated: true });
  }
  
  const backup = createBackup(space.id, fileData, fileHash);
  return c.json({ success: true, backupId: backup.id });
});

// Download backup
api.get('/backups/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const backup = getBackupById(id);
  if (!backup) return c.json({ error: 'Backup not found' }, 404);
  
  return new Response(backup.file_data, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-${backup.id}.excalidraw"`,
    },
  });
});

export default api;
