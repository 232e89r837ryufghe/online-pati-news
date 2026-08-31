/**
 * Search route — full-text search using D1 FTS5
 */
console.log('[Worker] Loading Search routes...');
import { Hono } from 'hono';
import type { Env } from '../index';
import { formatPostForFrontend } from './categories';
import { parsePagination, setPaginationHeaders } from '../utils/pagination';

const search = new Hono<{ Bindings: Env }>();

// GET /api/search?q=query — Full-text search
search.get('/', async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const query = url.searchParams.get('q') || url.searchParams.get('search') || '';
  const { perPage, offset } = parsePagination(url);

  if (!query.trim()) {
    return c.json([]);
  }

  try {
    // Use FTS5 for full-text search
    const results = await db.prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id IN (
         SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?
       ) AND p.status = 'published'
       ORDER BY p.published_at DESC
       LIMIT ? OFFSET ?`
    ).bind(query, perPage, offset).all();

    const nativePosts = results.results.map(formatPostForFrontend);
    return c.json(nativePosts);
  } catch (e) {
    // Fallback to LIKE search if FTS fails (e.g., special characters)
    const likeQuery = `%${query}%`;
    const results = await db.prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)
       AND p.status = 'published'
       ORDER BY p.published_at DESC
       LIMIT ? OFFSET ?`
    ).bind(likeQuery, likeQuery, likeQuery, perPage, offset).all();

    const nativePosts = results.results.map(formatPostForFrontend);
    return c.json(nativePosts);
  }
});

export default search;
