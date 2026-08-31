console.log('[Worker] Loading Media routes...');
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../index';

const media = new Hono<{ Bindings: Env }>();

// GET /api/media - List all media items
media.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM media ORDER BY created_at DESC'
    ).all();
    return c.json(results);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/media/upload - Upload a file
media.post('/upload', requireAuth, async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData.file as File;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const filename = file.name;
    const type = file.type;
    const size = file.size;
    
    // Generate a unique key for R2
    const timestamp = Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.]/g, '-');
    const key = `uploads/${timestamp}-${cleanFilename}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.MEDIA.put(key, arrayBuffer, {
      httpMetadata: { contentType: type },
    });

    // Determine the public URL
    // Use MEDIA_BASE_URL if configured, otherwise fallback to local proxy route
    const baseUrl = c.env.MEDIA_BASE_URL || '/cdn';
    const url = `${baseUrl.replace(/\/$/, '')}/${key}`;

    // Record in D1
    const { results } = await c.env.DB.prepare(
      'INSERT INTO media (filename, key, url, type, size) VALUES (?, ?, ?, ?, ?) RETURNING *'
    ).bind(filename, key, url, type, size).all();

    return c.json(results[0], 201);
  } catch (e: any) {
    console.error('Upload error:', e);
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /api/media/:id - Delete a media item
media.delete('/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  
  try {
    // Get the key from D1 first
    const item: any = await c.env.DB.prepare(
      'SELECT * FROM media WHERE id = ?'
    ).bind(id).first();

    if (!item) {
      return c.json({ error: 'Media not found' }, 404);
    }

    // Delete from R2
    await c.env.MEDIA.delete(item.key);

    // Delete from D1
    await c.env.DB.prepare(
      'DELETE FROM media WHERE id = ?'
    ).bind(id).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default media;
