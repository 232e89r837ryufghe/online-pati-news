/**
 * Auth routes — login, logout, session check, 2FA
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../index';
import { createSession, validateSession, requireAuth } from '../middleware/auth';
import { hashPassword } from '../utils/crypto';

const auth = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// POST /api/auth/login
auth.post('/login', async (c) => {
  console.log(`[Auth] Login attempt: ${c.req.header('CF-Connecting-IP') || 'unknown'}`);
  try {
    const body = await c.req.json<{ username: string; password: string }>();
    console.log(`[Auth] Checking credentials for: ${body.username}`);
    
    // 1. Check against Environment Variables (Primary / Fallback)
    const envUser = c.env.ADMIN_USERNAME || 'admin';
    const envPass = c.env.ADMIN_PASSWORD || 'onlinepati2026';
    
    let authenticated = false;
    let username = body.username;

    if (body.username === envUser && body.password === envPass) {
      console.log('[Auth] Authenticated via Environment Variables');
      authenticated = true;
    } else {
      // 2. Fallback to Database
      const db = c.env.DB;
      if (db) {
        try {
          console.log('[Auth] Querying DB for user...');
          const user = await db.prepare('SELECT * FROM users WHERE username = ?')
            .bind(body.username)
            .first<any>();

          if (user) {
            console.log('[Auth] User found in DB, verifying password...');
            const hash = await hashPassword(body.password);
            if (user.password_hash === hash) {
              authenticated = true;
            }
          }
        } catch (dbErr) {
          console.error('[Auth] Database check failed (likely table missing):', dbErr);
          // If DB fails but credentials match ENV, we already set authenticated = true above
          // If not, we fall through to 401
        }
      }
    }

    if (!authenticated) {
      console.warn(`[Auth] Authentication failed for: ${body.username}`);
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    // 3. Login success — create session
    console.log('[Auth] Login successful, creating session...');
    const token = await createSession(username, c.env);

    setCookie(c, 'session_token', token, {
      path: '/',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'Lax',
      secure: c.req.url.startsWith('https:'), 
    });
    
    console.log('[Auth] Login complete');
    return c.json({ 
      success: true, 
      token,
      user: { username }
    });
  } catch (err) {
    console.error('[Auth] Login Error:', err);
    return c.json({ 
      error: 'Internal Server Error', 
      message: err instanceof Error ? err.message : 'Unknown error during login' 
    }, 500);
  }
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  deleteCookie(c, 'session_token', { path: '/' });
  return c.json({ success: true });
});

// GET /api/auth/me
auth.get('/me', async (c) => {
  let token = "";
  
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = getCookie(c, 'session_token') || "";
  }

  const payload = token ? await validateSession(token, c.env) : null;

  if (!payload) {
    return c.json({ authenticated: false }, 401);
  }

  return c.json({ 
    authenticated: true,
    user: { username: payload.username }
  });
});

// POST /api/auth/change-password
auth.post('/change-password', requireAuth, async (c) => {
  const user = c.get('user');
  const { newPassword } = await c.req.json<{ newPassword: string }>();
  
  if (!newPassword || newPassword.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const passHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE username = ?'
  ).bind(passHash, user.username).run();

  return c.json({ success: true, message: 'Password updated successfully' });
});

// POST /api/auth/reset-password (Simplified)
auth.post('/reset-password', async (c) => {
  const { securityKey, username, newPassword } = await c.req.json<{ securityKey: string; username: string; newPassword: string }>();
  
  // Uses ADMIN_PASSWORD as a master key for reset
  const masterKey = c.env.ADMIN_PASSWORD || 'onlinepati2026';
  
  if (!securityKey || securityKey !== masterKey) {
    return c.json({ error: 'Invalid security key' }, 401);
  }

  const passHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE username = ?'
  ).bind(passHash, username).run();

  return c.json({ success: true, message: 'Password reset successful' });
});

export default auth;
