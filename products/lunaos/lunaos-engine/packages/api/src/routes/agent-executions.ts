/**
 * Agent Executions route — GET /agents/executions
 *
 * Lists a user's past agent executions with pagination.
 * Extracted from agents.ts to respect the 200-line file limit.
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';

export const agentExecutionRoutes = new Hono<{ Bindings: Env }>();

/** GET /agents/executions — list user's past executions */
agentExecutionRoutes.get('/executions', requireAuth, async (c) => {
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const results = await c.env.DB.prepare(
    `SELECT id, agent, provider, model, duration_ms, output_length, created_at
     FROM executions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(userId, limit, offset).all();

  return c.json({ executions: results.results, count: results.results?.length || 0 });
});
