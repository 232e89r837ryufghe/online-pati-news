/**
 * Online Pati News CMS — Main Worker Entry Point
 * 
 * Cloudflare Workers + Hono + D1
 * Serves both the REST API and the admin dashboard
 */
console.log('[Worker] Booting Online Pati CMS...');
import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import categoryRoutes from './routes/categories';
import searchRoutes from './routes/search';
import mediaRoutes from './routes/media';
import settingsRoutes from './routes/settings';
import adsRoutes from './routes/ads';

export interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  CORS_ORIGIN: string;
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  MEDIA_BASE_URL: string;
}

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// ─── Error Handling ───────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[Global Error] ${err.name}: ${err.message}`, err);
  return c.json({
    error: 'Internal Server Error',
    type: err.name,
    message: err.message,
    stack: err.stack
  }, 500);
});

// ─── Middleware ────────────────────────────────────────────────

app.use('*', logger());

const corsMiddleware = cors({
  origin: (origin, c) => {
    const allowed = c.env.CORS_ORIGIN || '*';
    if (allowed === '*' || allowed === origin) return origin || '*';
    return allowed;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-CMS-Total', 'X-CMS-TotalPages'],
  credentials: true,
});

app.use('/api/*', corsMiddleware);
app.use('/admin/api/*', corsMiddleware);

// ─── API Routes ────────────────────────────────────────────────

const api = new Hono<{ Bindings: Env; Variables: { user: any } }>();

api.onError((err, c) => {
  console.error(`[API Error] ${err.name}: ${err.message}`, err);
  return c.json({
    error: 'Internal Server Error',
    type: err.name,
    message: err.message,
    stack: err.stack
  }, 500);
});

api.route('/auth', authRoutes);
api.route('/posts', postRoutes);
api.route('/categories', categoryRoutes);
api.route('/search', searchRoutes);
api.route('/media', mediaRoutes);
api.route('/admin/settings', settingsRoutes);
api.route('/ads', adsRoutes);

// Mount API on both root and /admin for flexibility
app.route('/api', api);
app.route('/admin/api', api);

// ─── CDN Proxy to Serve Images from R2 (with Production Fallback) ─────────────────────────
app.get('/cdn/*', async (c) => {
  const key = c.req.path.replace('/cdn/', '').replace('/admin/cdn/', '');
  const object = await c.env.MEDIA.get(key);

  if (!object) {
    try {
      const prodUrl = `https://onlinepatinews.com/cdn/${key}`;
      const response = await fetch(prodUrl);
      if (response.ok) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      }
    } catch (e) {
      console.error('Failed to fallback fetch from production CDN:', e);
    }
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { headers });
});

app.get('/admin/cdn/*', async (c) => {
  const key = c.req.path.replace('/admin/cdn/', '').replace('/cdn/', '');
  const object = await c.env.MEDIA.get(key);

  if (!object) {
    try {
      const prodUrl = `https://onlinepatinews.com/cdn/${key}`;
      const response = await fetch(prodUrl);
      if (response.ok) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders
        });
      }
    } catch (e) {
      console.error('Failed to fallback fetch from production CDN:', e);
    }
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(object.body, { headers });
});

// ─── Health Check ──────────────────────────────────────────────

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'onlinepati-cms',
    timestamp: new Date().toISOString()
  });
});

app.get('/admin/api/health', (c) => {
  return c.json({ status: 'ok' });
});

// ─── Dashboard Stats ───────────────────────────────────────────

async function statsHandler(c: Context<{ Bindings: Env; Variables: { user: any } }>) {
  const db = c.env.DB;

  const [postsCount, publishedCount, draftsCount, categoriesCount, mediaCount, adsCount, activity] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM posts').first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'draft'").first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM categories').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM media').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM advertisements').first<{ count: number }>(),
    db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count 
      FROM posts 
      WHERE created_at >= date('now', '-7 days') 
      GROUP BY day 
      ORDER BY day ASC
    `).all()
  ]);

  return c.json({
    total_posts: postsCount?.count || 0,
    published_posts: publishedCount?.count || 0,
    draft_posts: draftsCount?.count || 0,
    total_categories: categoriesCount?.count || 0,
    total_media: mediaCount?.count || 0,
    total_ads: adsCount?.count || 0,
    activity: activity.results || []
  });
}

app.get('/api/admin/stats', statsHandler);
app.get('/admin/api/admin/stats', statsHandler);

// ─── Static Asset Serving (Cloudflare Worker Assets API) ───────────

app.get('/admin', (c) => c.redirect('/admin/'));

app.get('*', async (c) => {
  let url = new URL(c.req.url);

  if (url.pathname.endsWith('/')) {
    url.pathname += 'index.html';
  }

  try {
    let reqToFetch = new Request(url.toString(), c.req.raw);
    let response = await c.env.ASSETS.fetch(reqToFetch);

    if (response.status === 404 && !url.pathname.endsWith('.html')) {
      url.pathname += '.html';
      reqToFetch = new Request(url.toString(), c.req.raw);
      response = await c.env.ASSETS.fetch(reqToFetch);
    }

    if (response.status !== 404 && response.status !== 400) {
      return response;
    }
  } catch (e) { }

  return c.notFound();
});


export default app;