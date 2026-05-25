/**
 * Credential Rotation Completeness Routes
 *
 * POST /api/credential-rotation/declare-breach — Initialize rotation checklist
 * POST /api/credential-rotation/rotate — Mark a credential as rotated
 * POST /api/credential-rotation/verify — Verify rotation completeness
 * GET /api/credential-rotation/report — Get current rotation report
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import {
	generateRotationChecklist,
	updateChecklistWithRotation,
	verifyRotationCompleteness,
	buildRotationReport,
	type CredentialEntry,
	type RotationChecklistItem,
} from '../lib/credential-rotation-verifier';

export const credentialRotationRoutes = new Hono<AppEnv>();
credentialRotationRoutes.use('*', authMiddleware);

credentialRotationRoutes.post('/declare-breach', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{ credentials: CredentialEntry[] }>();
	if (!body.credentials || !Array.isArray(body.credentials)) {
		return c.json({ error: 'credentials array required' }, 400);
	}

	const breachAt = new Date();
	const checklist = generateRotationChecklist(body.credentials, breachAt);

	const state = { breachDeclaredAt: breachAt.toISOString(), checklist };
	await c.env.KV.put(`rotation:${tenantId}:state`, JSON.stringify(state), { expirationTtl: 86400 });

	return c.json({
		success: true,
		breachDeclaredAt: breachAt.toISOString(),
		totalCredentials: checklist.length,
		checklist,
	});
});

credentialRotationRoutes.post('/rotate', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{ credentialId: string }>();
	if (!body.credentialId) return c.json({ error: 'credentialId required' }, 400);

	const stateJson = await c.env.KV.get(`rotation:${tenantId}:state`, 'json') as any;
	if (!stateJson) return c.json({ error: 'No active breach rotation' }, 404);

	const breachAt = new Date(stateJson.breachDeclaredAt);
	const updated = updateChecklistWithRotation(
		stateJson.checklist as RotationChecklistItem[],
		body.credentialId,
		new Date(),
		breachAt
	);

	stateJson.checklist = updated;
	await c.env.KV.put(`rotation:${tenantId}:state`, JSON.stringify(stateJson), { expirationTtl: 86400 });

	const item = updated.find((i) => i.credentialId === body.credentialId);
	return c.json({ success: true, credential: item });
});

credentialRotationRoutes.post('/verify', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json<{
		auditLogs?: Array<{ credentialId: string; activities: Array<{
			timestamp: string; action: string; ipAddress: string; userAgent: string;
		}> }>;
	}>();

	const stateJson = await c.env.KV.get(`rotation:${tenantId}:state`, 'json') as any;
	if (!stateJson) return c.json({ error: 'No active breach rotation' }, 404);

	const verified = verifyRotationCompleteness(
		stateJson.checklist as RotationChecklistItem[],
		body.auditLogs || []
	);
	stateJson.checklist = verified;
	await c.env.KV.put(`rotation:${tenantId}:state`, JSON.stringify(stateJson), { expirationTtl: 86400 });

	const report = buildRotationReport(verified, new Date(stateJson.breachDeclaredAt));
	return c.json({ success: true, report });
});

credentialRotationRoutes.get('/report', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const stateJson = await c.env.KV.get(`rotation:${tenantId}:state`, 'json') as any;
	if (!stateJson) return c.json({ report: null, message: 'No active breach rotation' });

	const report = buildRotationReport(
		stateJson.checklist as RotationChecklistItem[],
		new Date(stateJson.breachDeclaredAt)
	);
	return c.json(report);
});
