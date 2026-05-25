/**
 * Approval Routes
 *
 * CRUD endpoints for managing approval requests. Approvals gate
 * destructive actions (license optimization, guest removal, etc.)
 * behind admin review before execution.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import {
	loadApproval,
	listApprovalIds,
	saveApproval,
	processApproval,
	moveApprovalIndex,
	type ApprovalRequest,
	type ItemDecision,
} from '../lib/workflows/approval-engine';
import { authMiddleware, requireRole, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';

const approvals = new Hono<AppEnv>();

approvals.use('*', authMiddleware);
approvals.use('*', standardRateLimit);

/** GET /api/approvals — list pending approvals for current tenant */
approvals.get('/', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const kv = c.env.KV;

	const pendingIds = await listApprovalIds(kv, tenantId, 'pending');
	const requests: ApprovalRequest[] = [];

	for (const id of pendingIds.slice(0, 50)) {
		const req = await loadApproval(kv, tenantId, id);
		if (req) requests.push(req);
	}

	return c.json({ approvals: requests, count: requests.length });
});

/** GET /api/approvals/history — past approval decisions */
approvals.get('/history', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const kv = c.env.KV;

	const statuses = ['approved', 'denied', 'partial'] as const;
	const results: ApprovalRequest[] = [];

	for (const status of statuses) {
		const ids = await listApprovalIds(kv, tenantId, status);
		for (const id of ids.slice(0, 20)) {
			const req = await loadApproval(kv, tenantId, id);
			if (req) results.push(req);
		}
	}

	results.sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));

	return c.json({ approvals: results, count: results.length });
});

/** GET /api/approvals/:id — get approval detail */
approvals.get('/:id', async (c) => {
	const tenantId = c.get('tenantId');
	const id = c.req.param('id');
	if (!id) return c.json({ error: 'Missing id' }, 400);
	const request = await loadApproval(c.env.KV, tenantId, id);

	if (!request) {
		return c.json({ error: 'Not Found' }, 404);
	}

	return c.json({ approval: request });
});

/** POST /api/approvals/:id/decide — approve/deny items */
approvals.post('/:id/decide', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.get('userId') ?? 'system';
	const id = c.req.param('id');
	if (!id) return c.json({ error: 'Missing id' }, 400);
	const kv = c.env.KV;

	const request = await loadApproval(kv, tenantId, id);
	if (!request) {
		return c.json({ error: 'Not Found' }, 404);
	}

	if (request.status !== 'pending') {
		return c.json({ error: 'Bad Request', message: 'Approval already decided' }, 400);
	}

	const body = await c.req.json<{ decisions: ItemDecision[] }>();
	if (!body.decisions?.length) {
		return c.json({ error: 'Bad Request', message: 'decisions array required' }, 400);
	}

	const result = processApproval(request, body.decisions, userId);

	await moveApprovalIndex(kv, tenantId, id, 'pending', result.status);
	await saveApproval(kv, tenantId, request);

	// Queue approved items for execution
	if (result.approvedItems.length > 0) {
		await c.env.REMEDIATION_QUEUE.send({
			type: `approval_execute_${request.type}`,
			approvalId: request.id,
			approvedItems: result.approvedItems,
			tenantId,
			decidedBy: userId,
		});
	}

	return c.json({ result });
});

export { approvals as approvalRoutes };
export default approvals;
