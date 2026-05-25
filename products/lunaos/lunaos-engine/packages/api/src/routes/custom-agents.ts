/**
 * Custom Agent CRUD Routes
 *
 * GET    /agents/custom       — list user's custom agents
 * POST   /agents/custom       — create a new custom agent
 * DELETE /agents/custom/:id   — delete a custom agent
 * GET    /agents/custom/gallery — list public custom agents
 * POST   /agents/custom/:id/fork — fork a public custom agent
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import { validateJson } from '../middleware/validation';
import { createCustomAgentSchema } from '../schemas';

export const customAgentRoutes = new Hono<{ Bindings: Env }>();

/** GET /gallery — list public custom agents */
customAgentRoutes.get('/gallery', async (c) => {
  const results = await c.env.DB.prepare(`
    SELECT c.*, u.name as author_name 
    FROM custom_agents c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.is_public = 1
    ORDER BY c.created_at DESC
    LIMIT 50
  `).all();

  const agents = (results.results || []).map((agent: any) => {
    let variants: any[] = [];
    try {
      variants = JSON.parse(agent.system_prompt || '[]');
    } catch {
      variants = [{ id: 'v1', content: agent.system_prompt, weight: 100 }];
    }
    return { ...agent, promptVariants: variants, isBase64: false };
  });

  return c.json({ agents });
});

/** POST /:id/fork — fork a public agent */
customAgentRoutes.post('/:id/fork', requireAuth, async (c) => {
  const userId = c.get('userId');
  const sourceId = c.req.param('id');

  // Fetch the source agent
  const sourceAgent = await c.env.DB.prepare(
    'SELECT * FROM custom_agents WHERE id = ? AND is_public = 1'
  ).bind(sourceId).first();

  if (!sourceAgent) {
    return c.json({ error: 'Public agent not found' }, 404);
  }

  const newId = `custom-${crypto.randomUUID()}`;
  const newSlug = `${sourceAgent.slug}-fork-${Date.now().toString(36)}`;

  try {
    await c.env.DB.prepare(`
      INSERT INTO custom_agents (id, user_id, name, slug, description, system_prompt, category, model, temperature, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      newId, userId, `${sourceAgent.name} (Forked)`, newSlug, sourceAgent.description || '',
      sourceAgent.system_prompt, sourceAgent.category,
      sourceAgent.model || null, sourceAgent.temperature ?? null
    ).run();

    return c.json({ success: true, id: newId, slug: newSlug });
  } catch (err: any) {
    return c.json({ error: 'Failed to fork agent' }, 500);
  }
});

/** GET / — list user's custom agents */
customAgentRoutes.get('/', requireAuth, async (c) => {
  const userId = c.get('userId');
  const results = await c.env.DB.prepare(
    'SELECT * FROM custom_agents WHERE user_id = ? ORDER BY created_at DESC',
  ).bind(userId).all();

  const agents = (results.results || []).map((agent: any) => {
    let variants: any[] = [];
    try {
      variants = JSON.parse(agent.system_prompt || '[]');
    } catch {
      variants = [{ id: 'v1', content: agent.system_prompt, weight: 100 }];
    }
    return { ...agent, promptVariants: variants };
  });

  return c.json({ agents });
});

/** POST /custom — create a new custom agent */
customAgentRoutes.post('/', requireAuth, validateJson(createCustomAgentSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const id = `custom-${crypto.randomUUID()}`;

  try {
    await c.env.DB.prepare(`
      INSERT INTO custom_agents (id, user_id, name, slug, description, system_prompt, category, model, temperature, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userId, body.name, body.slug, body.description || '',
      JSON.stringify(body.promptVariants), body.category,
      body.model || null, body.temperature ?? null, body.isPublic ? 1 : 0,
    ).run();

    return c.json({ success: true, id, slug: body.slug });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'You already have an agent with this slug' }, 400);
    }
    return c.json({ error: 'Database error' }, 500);
  }
});

/** DELETE /custom/:id — delete a custom agent */
customAgentRoutes.delete('/:id', requireAuth, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    'DELETE FROM custom_agents WHERE id = ? AND user_id = ?',
  ).bind(id, userId).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Agent not found or unauthorized' }, 404);
  }

  return c.json({ success: true });
});
