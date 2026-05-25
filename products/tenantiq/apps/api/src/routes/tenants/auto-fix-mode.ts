/**
 * Per-tenant auto-fix mode flag.
 *
 *   GET  /:id/auto-fix-mode    → { mode: 'live' | 'dry-run' }
 *   POST /:id/auto-fix-mode    → body { mode: 'live' | 'dry-run' }
 *
 * Stored in KV: `autofix:mode:<tenantId>`. Default behavior when unset is
 * dry-run (the auto-fix-handler reads the absence as dry-run too).
 *
 * Admin role required. Flipping to 'live' is logged via agent_actions so
 * the leaderboard reflects the policy change.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { logAgentAction } from '../../lib/agent-actions';

export const autoFixModeRoutes = new Hono<AppEnv>();

autoFixModeRoutes.get('/:id/auto-fix-mode', async (c) => {
	const id = c.req.param('id');
	const mode = (await c.env.KV.get(`autofix:mode:${id}`)) ?? 'dry-run';
	return c.json({ mode });
});

autoFixModeRoutes.post('/:id/auto-fix-mode', async (c) => {
	const id = c.req.param('id');
	const user = c.get('user');
	const role = user?.role ?? '';
	if (!isAdminRole(role)) {
		return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required to change auto-fix mode' } }, 403);
	}
	const body = await c.req.json<{ mode?: string }>().catch(() => ({} as { mode?: string }));
	if (body.mode !== 'live' && body.mode !== 'dry-run') {
		return c.json({ error: 'mode must be "live" or "dry-run"' }, 400);
	}

	await c.env.KV.put(`autofix:mode:${id}`, body.mode, { expirationTtl: 60 * 60 * 24 * 365 });
	await logAgentAction(c.env, {
		orgId: user?.orgId, tenantId: id, agent: 'auto-remediator', action: 'tool-invoked',
		metadata: { stage: 'mode-change', from: '?', to: body.mode, by: user?.email },
	});
	return c.json({ mode: body.mode, updatedBy: user?.email, updatedAt: new Date().toISOString() });
});

function isAdminRole(role: string): boolean {
	return role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || role === 'platform_admin';
}
