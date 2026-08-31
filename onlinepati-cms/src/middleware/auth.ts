/**
 * Auth middleware — validates session token from cookie or Authorization header
 * Uses stateless JWT for session persistence across Cloudflare Worker restarts
 */
console.log('[Worker] Loading Auth middleware...');
import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import type { Env } from '../index';

export async function createSession(username: string, env: Env): Promise<string> {
  const secret = env.SESSION_SECRET || 'onlinepati-default-secret-change-me';
  const payload = {
    username,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 Days expiration for longer sessions
  };
  return await sign(payload, secret);
}

export async function validateSession(token: string, env: Env): Promise<any> {
  const secret = env.SESSION_SECRET || 'onlinepati-default-secret-change-me';
  try {
    const payload = await verify(token, secret, 'HS256');
    return payload;
  } catch (e: any) {
    console.error(`[Auth] Session validation failed: ${e.message}`);
    if (secret === 'onlinepati-default-secret-change-me') {
      console.warn('[Auth] Warning: Using default session secret. Ensure SESSION_SECRET is set in environment vars.');
    }
    return null;
  }
}

/**
 * Middleware: Require authentication for admin routes
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  // Try to get token from header first (more explicit), then fallback to cookie
  let token = "";
  
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    // Fallback to cookie
    token = getCookie(c, 'session_token') || "";
  }

  if (!token) {
    return c.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, 401);
  }

  const payload = await validateSession(token, c.env);
  if (!payload) {
    console.warn(`[Auth] Invalid token rejected for path: ${c.req.path}`);
    // If we have a token but it's invalid, maybe it's a stale cookie?
    // Let's try to clear it if it was from a cookie
    if (!authHeader) {
      console.log('[Auth] Clearing stale cookie');
      c.header('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
    }
    return c.json({ error: 'Unauthorized', code: 'INVALID_TOKEN' }, 401);
  }

  // Set user info in context for downstream routes
  c.set('user', payload);

  await next();
}
