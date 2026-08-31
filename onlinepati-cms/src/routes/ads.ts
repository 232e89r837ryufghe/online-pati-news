/**
 * Advertisement routes — CRUD for managing site banners
 */
import { Hono } from 'hono';
import type { Env } from '../index';
import { requireAuth } from '../middleware/auth';
import { parsePagination } from '../utils/pagination';

const ads = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// ─── PUBLIC ────────────────────────────────────────────────────

// GET /api/ads — List active ads (used by Astro frontend)
ads.get('/', async (c) => {
  const db = c.env.DB;
  const position = c.req.query('position');

  let query = "SELECT * FROM advertisements WHERE status = 'active'";
  const params: any[] = [];

  if (position) {
    query += " AND position = ?";
    params.push(position);
  }

  query += " ORDER BY updated_at DESC";

  try {
    const results = await db.prepare(query).bind(...params).all();
    return c.json(results.results);
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch ads', message: err.message }, 500);
  }
});

// ─── ADMIN (Auth Required) ─────────────────────────────────────

// GET /api/admin/ads — List all ads for management
ads.get('/manage', requireAuth, async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const { perPage, offset } = parsePagination(url);

  try {
    const countResult = await db.prepare('SELECT COUNT(*) as total FROM advertisements').first<{ total: number }>();
    const total = countResult?.total || 0;

    const results = await db.prepare(
      'SELECT * FROM advertisements ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).bind(perPage, offset).all();

    return c.json({
      ads: results.results,
      total,
      page: parsePagination(url).page,
      per_page: perPage
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch ads', message: err.message }, 500);
  }
});

// POST /api/admin/ads — Create new ad
ads.post('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{
    title: string;
    image_url: string;
    link_url?: string;
    position: string;
    status?: 'active' | 'inactive';
    expiry_date?: string;
  }>();

  if (!body.title || !body.image_url || !body.position) {
    return c.json({ error: 'Title, Image URL, and Position are required' }, 400);
  }

  try {
    const result = await db.prepare(
      `INSERT INTO advertisements (title, image_url, link_url, position, status, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      body.title,
      body.image_url,
      body.link_url || '',
      body.position,
      body.status || 'active',
      body.expiry_date || null
    ).run();

    return c.json({ id: result.meta.last_row_id, success: true }, 201);
  } catch (err: any) {
    return c.json({ error: 'Failed to create ad', message: err.message }, 500);
  }
});

// PUT /api/admin/ads/:id — Update ad
ads.put('/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id') || '0', 10);
  const body = await c.req.json<{
    title?: string;
    image_url?: string;
    link_url?: string;
    position?: string;
    status?: 'active' | 'inactive';
    expiry_date?: string;
  }>();

  try {
    const existing = await db.prepare('SELECT * FROM advertisements WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ error: 'Ad not found' }, 404);

    await db.prepare(
      `UPDATE advertisements SET 
        title = COALESCE(?, title), 
        image_url = COALESCE(?, image_url), 
        link_url = COALESCE(?, link_url), 
        position = COALESCE(?, position), 
        status = COALESCE(?, status), 
        expiry_date = COALESCE(?, expiry_date), 
        updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      body.title || null,
      body.image_url || null,
      body.link_url || null,
      body.position || null,
      body.status || null,
      body.expiry_date !== undefined ? body.expiry_date : null,
      id
    ).run();

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: 'Failed to update ad', message: err.message }, 500);
  }
});

// DELETE /api/admin/ads/:id — Remove ad
ads.delete('/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id') || '0', 10);

  try {
    await db.prepare('DELETE FROM advertisements WHERE id = ?').bind(id).run();
    return c.json({ success: true, deleted: id });
  } catch (err: any) {
    return c.json({ error: 'Failed to delete ad', message: err.message }, 500);
  }
});

export default ads;
