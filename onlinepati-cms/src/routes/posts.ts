/**
 * Post routes — public listing + admin CRUD
 */
console.log('[Worker] Loading Post routes...');
import { Hono, Context } from 'hono';
import type { Env } from '../index';
import { requireAuth } from '../middleware/auth';
import { generateSlug, ensureUniqueSlug } from '../utils/slug';
import { parsePagination, setPaginationHeaders } from '../utils/pagination';
import { formatPostForFrontend } from './categories';
import { triggerDeployment } from './settings';

const posts = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// ─── PUBLIC ────────────────────────────────────────────────────

// GET /api/posts — List posts (paginated, optionally filtered by category)
posts.get('/', async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const { perPage, offset } = parsePagination(url);
  const categoryId = url.searchParams.get('categories');
  const slugFilter = url.searchParams.get('slug');

  // If slug filter is provided, return single post by slug
  if (slugFilter) {
    const post = await db.prepare(
      `SELECT p.*, 
        (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug))
         FROM categories c
         JOIN post_categories pc ON c.id = pc.category_id
         WHERE pc.post_id = p.id) as categories_json
       FROM posts p
       WHERE p.slug = ? AND p.status = 'published'
       LIMIT 1`
    ).bind(slugFilter).first<any>();

    if (!post) return c.json([]);
    return c.json([formatPostForFrontend({
      ...post,
      categories: JSON.parse(post.categories_json || '[]')
    })]);
  }

  // Build query based on filters
  let countQuery = "SELECT COUNT(*) as total FROM posts WHERE status = 'published'";
  let dataQuery = `SELECT p.*, 
                    (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug))
                     FROM categories c
                     JOIN post_categories pc ON c.id = pc.category_id
                     WHERE pc.post_id = p.id) as categories_json
                   FROM posts p
                   WHERE p.status = 'published'`;
  
  const params: any[] = [];

  if (categoryId) {
    countQuery = `SELECT COUNT(DISTINCT p.id) as total 
                  FROM posts p 
                  JOIN post_categories pc ON p.id = pc.post_id 
                  WHERE p.status = 'published' AND pc.category_id = ?`;
    dataQuery = `SELECT p.*, 
                   (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug))
                    FROM categories c
                    JOIN post_categories pc ON c.id = pc.category_id
                    WHERE pc.post_id = p.id) as categories_json
                 FROM posts p
                 JOIN post_categories pc ON p.id = pc.post_id
                 WHERE p.status = 'published' AND pc.category_id = ?`;
    params.push(parseInt(categoryId, 10));
  }

  dataQuery += ' ORDER BY p.published_at DESC LIMIT ? OFFSET ?';

  const countResult = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  const results = await db.prepare(dataQuery).bind(...params, perPage, offset).all();
  
  const nativePosts = results.results.map((row: any) => formatPostForFrontend({
    ...row,
    categories: JSON.parse(row.categories_json || '[]')
  }));

  const headers = new Headers();
  const pagination = parsePagination(url);
  setPaginationHeaders(headers, total, pagination);

  return c.json(nativePosts, 200, {
    'X-CMS-Total': headers.get('X-CMS-Total') || '0',
    'X-CMS-TotalPages': headers.get('X-CMS-TotalPages') || '0',
  });
});

// GET /api/posts/:slug
posts.get('/:slug', async (c) => {
  const db = c.env.DB;
  const slug = decodeURIComponent(c.req.param('slug'));

  const post = await db.prepare(
    `SELECT p.*, 
       (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug))
        FROM categories c
        JOIN post_categories pc ON c.id = pc.category_id
        WHERE pc.post_id = p.id) as categories_json
     FROM posts p
     WHERE p.slug = ? AND p.status = 'published'
     LIMIT 1`
  ).bind(slug).first<any>();

    if (!post) return c.json({ error: 'Post not found' }, 404);
    return c.json(formatPostForFrontend({
      ...post,
      categories: JSON.parse(post.categories_json || '[]')
    }));
});

// GET /api/admin/posts — List all posts for admin
posts.get('/admin/list', requireAuth, async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const { perPage, offset } = parsePagination(url);
  const status = url.searchParams.get('status');

  let query = `SELECT p.*, 
                (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'slug', c.slug))
                 FROM categories c
                 JOIN post_categories pc ON c.id = pc.category_id
                 WHERE pc.post_id = p.id) as categories_json
               FROM posts p`;
  let countQuery = 'SELECT COUNT(*) as total FROM posts';
  const params: any[] = [];

  if (status) {
    query += ' WHERE p.status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?';

  const countResult = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  const results = await db.prepare(query).bind(...params, perPage, offset).all();

  return c.json({
    posts: results.results.map((row: any) => ({
      ...row,
      categories: JSON.parse(row.categories_json || '[]')
    })),
    total,
    page: parsePagination(url).page,
    per_page: perPage,
  });
});

// GET /api/admin/posts/:id — Get single post for editing
posts.get('/admin/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id') || '0', 10);

  const post = await db.prepare(
    `SELECT p.*, 
       (SELECT json_group_array(c.id)
        FROM categories c
        JOIN post_categories pc ON c.id = pc.category_id
        WHERE pc.post_id = p.id) as category_ids_json
     FROM posts p
     WHERE p.id = ?`
  ).bind(id).first<any>();

  if (!post) return c.json({ error: 'Post not found' }, 404);

  return c.json({
    ...post,
    category_ids: JSON.parse(post.category_ids_json || '[]')
  });
});

// POST /api/admin/posts — Create post
posts.post('/admin', requireAuth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{
    title: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    author?: string;
    status?: 'draft' | 'published' | 'archived';
    category_ids?: number[];
    share_fb?: boolean;
    share_ig?: boolean;
    show_image?: boolean;
    subheading?: string;
  }>();

  if (!body.title) return c.json({ error: 'Title is required' }, 400);

  const status = body.status || 'draft';
  const publishedAt = status === 'published' ? new Date().toISOString() : null;

  const firstCategoryId = body.category_ids && body.category_ids.length > 0 ? body.category_ids[0] : null;

  // DB Insert
  const result = await db.prepare(
    `INSERT INTO posts (title, content, excerpt, featured_image, author, status, published_at, category_id, slug, show_image, subheading)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.title,
    body.content || '',
    body.excerpt || body.content?.replace(/<[^>]*>?/gm, '').substring(0, 200) || '',
    body.featured_image || '',
    body.author || 'अनलाइन पाटी',
    status,
    publishedAt,
    firstCategoryId,
    // Temporary slug
    `tmp-${Date.now()}`,
    body.show_image !== undefined ? (body.show_image ? 1 : 0) : 1,
    body.subheading || ''
  ).run();

  const postId = result.meta.last_row_id;
  
  // Generate final slug: YYYYMMDD + ID
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const finalSlug = `${dateStr}${postId}`;

  await db.prepare('UPDATE posts SET slug = ? WHERE id = ?')
    .bind(finalSlug, postId)
    .run();

  // Handle Categories (Join Table)
  if (body.category_ids && body.category_ids.length > 0) {
    const stmts = body.category_ids.map(catId => 
      db.prepare('INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)').bind(postId, catId)
    );
    await db.batch(stmts);
  }

  // Social Sharing & Deployment Trigger
  if (status === 'published') {
    if (body.featured_image) {
      c.executionCtx.waitUntil(
        handleSocialSharing(c, {
          title: body.title,
          slug: finalSlug,
          featured_image: body.featured_image,
          share_fb: body.share_fb,
          share_ig: body.share_ig
        })
      );
    }
    c.executionCtx.waitUntil(triggerDeployment(c));
  }

  return c.json({ id: postId, slug: finalSlug, success: true }, 201);
});

// PUT /api/admin/posts/:id — Update post
posts.put('/admin/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id') || '0', 10);
  const body = await c.req.json<{
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    author?: string;
    status?: 'draft' | 'published' | 'archived';
    category_ids?: number[];
    share_fb?: boolean;
    share_ig?: boolean;
    show_image?: boolean;
    subheading?: string;
  }>();

  const existing = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>();
  if (!existing) return c.json({ error: 'Post not found' }, 404);

  const title = body.title || existing.title;
  let slug = existing.slug;

  // If slug is not in ymdID format (numeric, long enough), regenerate it
  if (!/^\d{9,}$/.test(slug)) {
    const datePart = (existing.created_at || new Date().toISOString()).split('T')[0].replace(/-/g, '');
    slug = `${datePart}${id}`;
  }

  const status = body.status || existing.status;
  let publishedAt = existing.published_at;
  if (status === 'published' && existing.status !== 'published') {
    publishedAt = new Date().toISOString();
  }

  const firstCategoryId = body.category_ids && body.category_ids.length > 0 ? body.category_ids[0] : existing.category_id;

  // Update Posts table
  await db.prepare(
    `UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, 
     author = ?, status = ?, published_at = ?, category_id = ?, show_image = ?, subheading = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    title,
    slug,
    body.content !== undefined ? body.content : existing.content,
    body.excerpt !== undefined ? body.excerpt : existing.excerpt,
    body.featured_image !== undefined ? body.featured_image : existing.featured_image,
    body.author || existing.author,
    status,
    publishedAt,
    firstCategoryId,
    body.show_image !== undefined ? (body.show_image ? 1 : 0) : (existing.show_image !== undefined ? existing.show_image : 1),
    body.subheading !== undefined ? body.subheading : (existing.subheading || ''),
    id
  ).run();

  // Update Categories
  if (body.category_ids !== undefined) {
    await db.prepare('DELETE FROM post_categories WHERE post_id = ?').bind(id).run();
    if (body.category_ids.length > 0) {
      const stmts = body.category_ids.map(catId => 
        db.prepare('INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)').bind(id, catId)
      );
      await db.batch(stmts);
    }
  }

  // Social Sharing & Deployment Trigger
  if (status === 'published') {
    if (existing.status !== 'published' && (body.featured_image || existing.featured_image)) {
      c.executionCtx.waitUntil(
        handleSocialSharing(c, {
          title,
          slug,
          featured_image: body.featured_image || existing.featured_image,
          share_fb: body.share_fb,
          share_ig: body.share_ig
        })
      );
    }
    c.executionCtx.waitUntil(triggerDeployment(c));
  } else if (existing.status === 'published' && status !== 'published') {
    // If unpublishing, trigger build to remove from list
    c.executionCtx.waitUntil(triggerDeployment(c));
  }

  return c.json({ success: true });
});

// DELETE /api/admin/posts/:id — Delete post
posts.delete('/admin/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id') || '0', 10);

  // Get categories before deleting for count update
  const categories = await db.prepare(
    'SELECT category_id FROM post_categories WHERE post_id = ?'
  ).bind(id).all();

  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();

  // Update category count for all categories this post was in
  if (categories.results && categories.results.length > 0) {
    for (const row of categories.results as any[]) {
      await db.prepare(
        `UPDATE categories SET count = (
          SELECT COUNT(*) FROM post_categories pc 
          JOIN posts p ON pc.post_id = p.id 
          WHERE pc.category_id = ? AND p.status = 'published'
        ) WHERE id = ?`
      ).bind(row.category_id, row.category_id).run();
    }
    // Trigger build since published content might have changed
    c.executionCtx.waitUntil(triggerDeployment(c));
  }

  return c.json({ success: true, deleted: id });
});

/**
 * Helper: Handles social sharing to Facebook and Instagram
 * - Facebook: Native binary upload (Multipart)
 * - Instagram: Upload via Public URL (Instagram limitation)
 */
async function handleSocialSharing(c: Context<{ Bindings: Env; Variables: any }>, data: {
  title: string;
  subheading?: string;
  slug: string;
  featured_image: string;
  share_fb?: boolean;
  share_ig?: boolean;
}) {
  const db = c.env.DB;
  const origin = new URL(c.req.url).origin;
  const siteUrl = `https://onlinepatinews.com/category/${data.slug}`;
  
  // Construct caption as per user request
  let captionText = data.title;
  if (data.subheading && data.subheading.trim()) {
    captionText += `\n${data.subheading}`;
  }
  captionText += `\n\nFull Detail News: ${siteUrl}`;

  try {
    // 1. Resolve image source
    let imageBlob: Blob | null = null;
    let publicImageUrl = data.featured_image;

    // If it's a relative CDN URL, fetch from R2
    if (data.featured_image.startsWith('/cdn/')) {
      const key = data.featured_image.replace('/cdn/', '');
      const object = await c.env.MEDIA.get(key);
      if (object) {
        const buffer = await object.arrayBuffer();
        imageBlob = new Blob([buffer], { type: object.httpMetadata?.contentType || 'image/jpeg' });
        publicImageUrl = `${origin}${data.featured_image}`;
      }
    } else if (data.featured_image.startsWith('http')) {
      try {
        const res = await fetch(data.featured_image);
        if (res.ok) imageBlob = await res.blob();
      } catch (e) {
        console.error("Social Sharing: Failed to fetch external image:", e);
      }
    }

    // 2. Post to Facebook (Native Photo Upload if image exists, Status Update otherwise)
    if (data.share_fb) {
      const tokenRes = await db.prepare('SELECT value FROM settings WHERE key="FB_PAGE_TOKEN"').first<{value:string}>();
      const pageIdRes = await db.prepare('SELECT value FROM settings WHERE key="FB_PAGE_ID"').first<{value:string}>();
      
      if (tokenRes?.value && pageIdRes?.value) {
        if (imageBlob || (data.featured_image && data.featured_image.startsWith('http'))) {
          // Photo Post
          const fbFormData = new FormData();
          fbFormData.append('access_token', tokenRes.value);
          fbFormData.append('caption', captionText);
          
          if (imageBlob) {
            fbFormData.append('source', imageBlob);
          } else {
            fbFormData.append('url', data.featured_image);
          }

          const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageIdRes.value}/photos`, {
            method: 'POST',
            body: fbFormData
          });
          const fbResult = await fbRes.json();
          console.log("Facebook Auto-post (Photo) result:", fbResult);
        } else {
          // Status Update (Text Only)
          const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageIdRes.value}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: tokenRes.value,
              message: captionText
            })
          });
          const fbResult = await fbRes.json();
          console.log("Facebook Auto-post (Status) result:", fbResult);
        }
      }
    }

    // 3. Post to Instagram (Requires Public URL)
    if (data.share_ig) {
      const igTokenRes = await db.prepare('SELECT value FROM settings WHERE key="IG_ACCESS_TOKEN"').first<{value:string}>();
      const igUserIdRes = await db.prepare('SELECT value FROM settings WHERE key="IG_USER_ID"').first<{value:string}>();
      
      if (igTokenRes?.value && igUserIdRes?.value && publicImageUrl.startsWith('http')) {
        // Create Media Container
        const createRes = await fetch(`https://graph.facebook.com/v19.0/${igUserIdRes.value}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image_url: publicImageUrl, 
            caption: captionText, 
            access_token: igTokenRes.value 
          })
        }).then(r => r.json() as any);

        // Publish Container
        if (createRes.id) {
          const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserIdRes.value}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              creation_id: createRes.id, 
              access_token: igTokenRes.value 
            })
          }).then(r => r.json());
          console.log("Instagram Auto-post result:", publishRes);
        } else {
          console.error("Instagram Media Container Creation Failed:", createRes);
        }
      }
    }
  } catch (err) {
    console.error("handleSocialSharing Error:", err);
  }
}

export default posts;
