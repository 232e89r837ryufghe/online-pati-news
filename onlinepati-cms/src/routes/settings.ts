console.log('[Worker] Loading Settings routes...');
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../index';

const settings = new Hono<{ Bindings: Env }>();

// GET /api/admin/settings - Get all settings
settings.get('/', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT key, value FROM settings'
    ).all();
    
    // Convert array to object for easier consumption
    const settingsObj = results.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    
    return c.json(settingsObj);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/admin/settings - Save or update settings
settings.post('/', requireAuth, async (c) => {
  try {
    const body = await c.req.json<Record<string, string>>();
    
    const db = c.env.DB;
    const items = Object.entries(body);
    
    for (const [key, value] of items) {
      await db.prepare(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now")) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      ).bind(key, value).run();
    }
    
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/admin/deploy - Trigger Deployment via Proxy Webhook
settings.post('/deploy', requireAuth, async (c) => {
  const success = await triggerDeployment(c);
  if (!success) {
    return c.json({ error: 'Deployment trigger failed. Check logs.' }, 500);
  }
  return c.json({ success: true, message: 'Deployment triggered successfully.' });
});

/**
 * Helper to trigger external deployment build
 */
export async function triggerDeployment(c: any) {
  try {
    const db = c.env.DB;
    const deployUrlRes = await db.prepare('SELECT value FROM settings WHERE key = "DEPLOY_URL"').first() as { value: string } | undefined;
    const deployUrl = deployUrlRes?.value || 'https://still-limit-18a3.silent-meadow-ff04.workers.dev/';

    console.log(`[DeploymentTrigger] Initializing build request to: ${deployUrl}`);
    
    const startTime = Date.now();
    // Default to POST as standard for Dispatch Workers
    const response = await fetch(deployUrl, { 
      method: 'POST',
      headers: { 
        'User-Agent': 'Online-Pati-CMS-Worker',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        action: 'deploy', 
        timestamp: new Date().toISOString(),
        site: 'onlinepatinews.com'
      })
    });
    
    // Fallback to GET only if configured or if the URL looks like a simple ping
    let duration = Date.now() - startTime;

    if (!response.ok) {
      // Try GET as a fallback if POST fails with 405 (Method Not Allowed)
      if (response.status === 405) {
        console.warn(`[DeploymentTrigger] POST failed with 405, retrying with GET...`);
        const getRes = await fetch(deployUrl, { method: 'GET' });
        if (getRes.ok) {
          console.log(`[DeploymentTrigger] Success with GET fallback in ${Date.now() - startTime}ms`);
          return true;
        }
      }
      
      const errorText = await response.text();
      console.error(`[DeploymentTrigger] Failed [${response.status}] after ${duration}ms: ${errorText}`);
      return false;
    }

    console.log(`[DeploymentTrigger] Success [${response.status}] in ${duration}ms`);
    return true;
  } catch (e) {
    console.error(`[DeploymentTrigger] Exception:`, e);
    return false;
  }
}

export default settings;
