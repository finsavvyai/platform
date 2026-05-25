/**
 * Approve / abort handlers for pending-approval agent actions.
 *
 *   POST /:id/approve   re-enqueue the original auto-fix message in live mode
 *   POST /:id/abort     mark the row as aborted, no follow-up
 *
 * Admin role required to flip a dry-run row to live. The original action
 * row stays as-is; the approve/abort writes a NEW agent_action linked via
 * `metadata.parentId` so the audit trail is append-only.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { logAgentAction } from '../lib/agent-actions';

export const agentApprovalRoutes = new Hono<AppEnv>();
agentApprovalRoutes.use('*', authMiddleware);

interface PendingRow {
	id: string; org_id: string; tenant_id: string;
	agent: string; action: string; finding_id: string | null;
	severity: string | null; status: string; metadata: string | null;
}

agentApprovalRoutes.post('/:id/approve', async (c) => {
	const user = c.get('user');
	if (!isAdmin(user?.role)) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);

	const row = await fetchPending(c, c.req.param('id'), user!.orgId);
	if (!row) return c.json({ error: 'Not found or not pending approval' }, 404);

	const meta = safeJson(row.metadata);
	const recipeId = (meta?.recipeId as string | undefined) ?? null;
	const driftId = row.finding_id ?? '';

	if (!recipeId || !driftId) {
		return c.json({ error: 'Original action missing recipeId/findingId — cannot re-enqueue' }, 422);
	}

	await c.env.REMEDIATION_QUEUE?.send?.({
		type: 'auto-fix',
		tenantId: row.tenant_id,
		orgId: row.org_id,
		driftId,
		recipeId,
		severity: (row.severity ?? 'medium') as 'critical' | 'high' | 'medium' | 'low' | 'info',
		dryRun: false, // approved → live mutation
	}).catch((err: unknown) => console.error('[approval] enqueue failed', err));

	await logAgentAction(c.env, {
		orgId: row.org_id, tenantId: row.tenant_id, agent: 'auto-remediator', action: 'tool-invoked',
		findingId: row.finding_id, severity: (row.severity ?? null) as 'critical' | 'high' | 'medium' | 'low' | 'info' | null,
		status: 'approved',
		metadata: { stage: 'approved-by-admin', parentId: row.id, by: user?.email },
	});

	return c.json({ ok: true, parentId: row.id, by: user?.email, at: new Date().toISOString() });
});

agentApprovalRoutes.post('/:id/abort', async (c) => {
	const user = c.get('user');
	if (!isAdmin(user?.role)) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);

	const row = await fetchPending(c, c.req.param('id'), user!.orgId);
	if (!row) return c.json({ error: 'Not found or not pending approval' }, 404);

	await logAgentAction(c.env, {
		orgId: row.org_id, tenantId: row.tenant_id, agent: 'auto-remediator', action: 'tool-invoked',
		findingId: row.finding_id, severity: (row.severity ?? null) as 'critical' | 'high' | 'medium' | 'low' | 'info' | null,
		status: 'aborted',
		metadata: { stage: 'aborted-by-admin', parentId: row.id, by: user?.email },
	});

	return c.json({ ok: true, parentId: row.id, by: user?.email, at: new Date().toISOString() });
});

async function fetchPending(c: { env: AppEnv['Bindings'] }, id: string, orgId: string): Promise<PendingRow | null> {
	const row = await c.env.DB.prepare(
		`SELECT id, org_id, tenant_id, agent, action, finding_id, severity, status, metadata
		 FROM agent_actions WHERE id = ? AND org_id = ? AND status = 'pending-approval' LIMIT 1`,
	).bind(id, orgId).first<PendingRow>().catch(() => null);
	return row;
}

function isAdmin(role?: string): boolean {
	return role === 'admin' || role === 'tenant_admin' || role === 'super_admin' || role === 'platform_admin';
}

function safeJson(s: string | null): Record<string, unknown> | null {
	if (!s) return null;
	try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}
