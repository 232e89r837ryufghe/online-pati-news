// src/routes/proxy.ts
import { Hono } from 'hono';
import type { Env } from '../index';

const proxy = new Hono<{ Bindings: Env }>();

// ─── Proxy for Nepse Alpha indices ────────────────────────
proxy.get('/indices', async (c) => {
  const externalUrl = 'https://nepsealpha.com/api/indices';
  try {
    const resp = await fetch(externalUrl);
    const data = await resp.json();
    // Return JSON with CORS headers
    return c.json(data, 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
  } catch (err: any) {
    return c.json({ error: 'Failed to fetch remote indices', message: err.message }, 500);
  }
});

export default proxy;
