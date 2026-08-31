/**
 * Slug generation utility — handles Nepali (Devanagari) Unicode text
 */

/**
 * Generate a URL-safe slug from text.
 * Preserves Devanagari characters, ASCII alphanumerics, and hyphens.
 */
export function generateSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0900-\u097F\u0966-\u096Fa-z0-9-]/g, '') // Keep Devanagari + latin alphanum + hyphens
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure a slug is unique by appending a suffix if needed.
 * Queries the given table in D1 to check for collisions.
 */
export async function ensureUniqueSlug(
  db: D1Database,
  table: 'posts' | 'categories',
  slug: string,
  excludeId?: number
): Promise<string> {
  let candidate = slug;
  let counter = 1;

  while (true) {
    const query = excludeId
      ? `SELECT id FROM ${table} WHERE slug = ? AND id != ?`
      : `SELECT id FROM ${table} WHERE slug = ?`;
    
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const existing = await db.prepare(query).bind(...params).first();

    if (!existing) return candidate;

    counter++;
    candidate = `${slug}-${counter}`;
  }
}
