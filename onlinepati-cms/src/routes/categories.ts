/**
 * Category routes — public listing + admin CRUD
 */
console.log('[Worker] Loading Category routes...');
import { Hono } from 'hono';
import type { Env } from '../index';
import { requireAuth } from '../middleware/auth';
import { generateSlug, ensureUniqueSlug } from '../utils/slug';

const categories = new Hono<{ Bindings: Env }>();

// ─── PUBLIC ────────────────────────────────────────────────────

// GET /api/categories — List all categories
categories.get('/', async (c) => {
  const db = c.env.DB;
  const perPage = parseInt(c.req.query('per_page') || '100', 10);
  
  const results = await db.prepare(
    'SELECT * FROM categories ORDER BY id ASC LIMIT ?'
  ).bind(perPage).all();

  // Return in Native CMS format
  const nativeCategories = results.results.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    parent: cat.parent_id || 0,
    count: cat.count,
  }));

  return c.json(nativeCategories);
});

// GET /api/categories/:slug/posts — Posts by category slug
categories.get('/:slug/posts', async (c) => {
  const db = c.env.DB;
  const slug = decodeURIComponent(c.req.param('slug'));
  const perPage = parseInt(c.req.query('per_page') || '10', 10);

  // Find category
  const category = await db.prepare(
    'SELECT * FROM categories WHERE slug = ?'
  ).bind(slug).first();

  if (!category) {
    return c.json([], 200);
  }

  // Get posts in this category using the join table
  const posts = await db.prepare(
    `SELECT p.*, 
       (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug))
        FROM categories c
        JOIN post_categories pc ON c.id = pc.category_id
        WHERE pc.post_id = p.id) as categories_json
     FROM posts p
     JOIN post_categories pc2 ON p.id = pc2.post_id
     WHERE pc2.category_id = ? AND p.status = 'published'
     ORDER BY p.published_at DESC
     LIMIT ?`
  ).bind(category.id, perPage).all();

  // Return Native CMS format
  const nativePosts = posts.results.map((row: any) => formatPostForFrontend({
    ...row,
    categories: JSON.parse(row.categories_json || '[]')
  }));

  return c.json(nativePosts);
});

// ─── ADMIN ────────────────────────────────────────────────────

// POST /api/admin/categories — Create category
categories.post('/admin', requireAuth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{
    name: string;
    slug?: string;
    description?: string;
    parent_id?: number;
  }>();

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  let slug = body.slug || generateSlug(body.name);
  slug = await ensureUniqueSlug(db, 'categories', slug);

  const result = await db.prepare(
    `INSERT INTO categories (name, slug, description, parent_id)
     VALUES (?, ?, ?, ?)`
  ).bind(
    body.name,
    slug,
    body.description || '',
    body.parent_id || null
  ).run();

  const newCategory = await db.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(result.meta.last_row_id).first();

  return c.json(newCategory, 201);
});

// PUT /api/admin/categories/:id — Update category
categories.put('/admin/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{
    name?: string;
    slug?: string;
    description?: string;
    parent_id?: number;
  }>();

  const existing = await db.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }

  const name = body.name || existing.name as string;
  let slug = body.slug || existing.slug as string;
  
  if (body.slug && body.slug !== existing.slug) {
    slug = await ensureUniqueSlug(db, 'categories', body.slug, id);
  }

  await db.prepare(
    `UPDATE categories SET name = ?, slug = ?, description = ?, parent_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    name,
    slug,
    body.description !== undefined ? body.description : existing.description,
    body.parent_id !== undefined ? body.parent_id : existing.parent_id,
    id
  ).run();

  const updated = await db.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(id).first();

  return c.json(updated);
});

// DELETE /api/admin/categories/:id — Delete category
categories.delete('/admin/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  const existing = await db.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }

  // post_categories will be cleaned up by ON DELETE CASCADE
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

  return c.json({ success: true, deleted: id });
});

// Helper: Format a DB post row into a clean Native CMS JSON
function formatPostForFrontend(row: any) {
  // Extract categories from passed row (already an array)
  const categories = row.categories || [];
  
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt || '',
    date: row.published_at || row.created_at,
    status: row.status,
    featured_image: row.featured_image || '',
    show_image: row.show_image !== 0,
    subheading: row.subheading || '',
    author: row.author || 'अनलाइन पाटी',
    categories: categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug
    }))
  };
}

export { formatPostForFrontend };
export default categories;
