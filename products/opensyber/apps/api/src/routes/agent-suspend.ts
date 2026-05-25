/**
 * Agent Suspension Routes
 *
 * One-click agent suspension for compromised agents.
 * Now executes real Hetzner poweroff/restart actions.
 */
import { Hono } from 'hono';
import { validateSuspensionAction, executeSuspensionAction } from '../services/agent-suspension.js';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { suspendActionSchema } from './validation/agent-suspend.js';

export const agentSuspendRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

agentSuspendRoutes.use('*', authMiddleware);

agentSuspendRoutes.post('/suspend/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const parsed = suspendActionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const validation = validateSuspensionAction(parsed.data.currentStatus ?? 'active', 'suspend');
  if (!validation.valid) return c.json({ error: validation.error }, 400);
  const result = await executeSuspensionAction(
    agentId, 'suspend', c.get('db') as any, c.env, parsed.data.reason,
  );
  return c.json({ data: result }, result.success ? 200 : 500);
});

agentSuspendRoutes.post('/resume/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const parsed = suspendActionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const validation = validateSuspensionAction(parsed.data.currentStatus ?? 'suspended', 'resume');
  if (!validation.valid) return c.json({ error: validation.error }, 400);
  const result = await executeSuspensionAction(
    agentId, 'resume', c.get('db') as any, c.env,
  );
  return c.json({ data: result }, result.success ? 200 : 500);
});

agentSuspendRoutes.post('/quarantine/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const parsed = suspendActionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const validation = validateSuspensionAction(parsed.data.currentStatus ?? 'active', 'quarantine');
  if (!validation.valid) return c.json({ error: validation.error }, 400);
  const result = await executeSuspensionAction(
    agentId, 'quarantine', c.get('db') as any, c.env, parsed.data.reason,
  );
  return c.json({ data: result }, result.success ? 200 : 500);
});
