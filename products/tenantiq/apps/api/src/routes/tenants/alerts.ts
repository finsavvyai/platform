/**
 * Tenant alert routes: list alerts, remediation plan.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { forbidden } from '../../lib/errors';
import { verifyTenantAccess } from './helpers';
import {
	generateImpactExplanation,
	generateAffectedResources,
	generateRemediationSteps,
	generatePositiveOutcomes,
	generateNegativeOutcomes,
	generateUserEffects,
} from '../../lib/remediation-helpers';
import { estimateTimeToComplete } from '../../lib/remediation/time-to-complete';

export const alertRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/alerts/:alertId/remediation-plan
alertRoutes.get('/:id/alerts/:alertId/remediation-plan', async (c) => {
	const tenantId = c.req.param('id');
	const alertId = c.req.param('alertId');
	if (!verifyTenantAccess(c, tenantId)) throw forbidden('You do not have access to this tenant');
	const db = c.env.DB;

	const alert = await db.prepare('SELECT id, severity, title, affected_users, estimated_risk_score, metadata FROM alerts WHERE id = ? AND tenant_id = ?')
		.bind(alertId, tenantId).first();

	if (!alert) return c.json({ error: 'Alert not found' }, 404);

	const severity = alert.severity as string;
	const title = alert.title as string;
	const affectedUsers = Number(alert.affected_users ?? 0);

	// The actual impacted identities live in `metadata.users` (written by alert-generator).
	// Join against users_cache for richer fields (mail, job_title) when available.
	let meta: { users?: Array<{ name?: string; display_name?: string; days?: number }> } = {};
	try { meta = JSON.parse((alert.metadata as string) ?? '{}'); } catch { /* keep empty */ }
	const metaNames = (meta.users ?? []).map((u) => String(u.name ?? u.display_name ?? '')).filter(Boolean);

	let affectedDetails: Array<{ name: string; email: string; role: string }> = [];
	if (metaNames.length > 0) {
		const placeholders = metaNames.map(() => '?').join(',');
		const matched = await db.prepare(`SELECT display_name, mail, user_principal_name, job_title FROM users_cache WHERE tenant_id = ? AND display_name IN (${placeholders})`)
			.bind(tenantId, ...metaNames).all().catch(() => ({ results: [] as any[] }));
		affectedDetails = matched.results.map((u: any) => ({
			name: u.display_name,
			email: u.mail ?? u.user_principal_name ?? '',
			role: u.job_title || 'User',
		}));
		// Fallback: names in metadata that aren't in cache still get shown without email.
		for (const n of metaNames) {
			if (!affectedDetails.some((a) => a.name === n)) affectedDetails.push({ name: n, email: '', role: 'User' });
		}
	}

	// Time-to-complete: median + p90 from remediation_log (T2.3) when there
	// are 5+ historical samples for the same alert title; falls back to a
	// severity-tiered default literal otherwise.
	const orgId = c.get('user')?.orgId ?? '';
	const tte = await estimateTimeToComplete(
		c.env.DB as unknown as Parameters<typeof estimateTimeToComplete>[0],
		c.env.KV as unknown as Parameters<typeof estimateTimeToComplete>[1],
		orgId,
		title,
		(severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') ? severity : 'medium',
	);

	const plan = {
		impactLevel: severity === 'critical' ? 'Critical' : severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low',
		impactExplanation: generateImpactExplanation(title, severity),
		riskScore: Number(alert.estimated_risk_score ?? 50),
		affectedUsers: affectedDetails,
		affectedResources: generateAffectedResources(title),
		estimatedTime: tte.source === 'historical'
			? `${tte.displayMinutes} minutes (median ${tte.medianMinutes}, p90 ${tte.p90Minutes})`
			: `${tte.displayMinutes} minutes (no historical data)`,
		estimatedTimeMeta: {
			displayMinutes: tte.displayMinutes,
			medianMinutes: tte.medianMinutes,
			p90Minutes: tte.p90Minutes,
			historicalSamples: tte.historicalSamples,
			source: tte.source,
		},
		reversible: true,
		steps: generateRemediationSteps(title),
		outcomes: {
			ifRemediated: generatePositiveOutcomes(title),
			ifIgnored: generateNegativeOutcomes(title, severity),
		},
		userEffects: generateUserEffects(title, affectedUsers),
	};

	return c.json(plan);
});

// GET /api/tenants/:id/alerts
alertRoutes.get('/:id/alerts', async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	const db = c.env.DB;
	const result = await db
		.prepare('SELECT id, tenant_id, type, severity, title, description, source, status, estimated_cost_impact, affected_users, created_at, resolved_at FROM alerts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50')
		.bind(id)
		.all();
	return c.json({ alerts: result.results, total: result.results.length });
});

// GET /api/tenants/:id/audit
alertRoutes.get('/:id/audit', async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	// Scope audit query to the caller's org (not to :id, which is a tenant id).
	const user = c.get('user') as { orgId?: string } | undefined;
	const orgId = user?.orgId ?? '';
	const db = c.env.DB;
	const url = new URL(c.req.url);
	const rawFilter = url.searchParams.get('action') || '';
	// Cap and escape LIKE metacharacters to prevent pathological scans.
	const filterAction = rawFilter.slice(0, 64).replace(/[%_\\]/g, (m) => '\\' + m);
	const pageNum = Math.max(1, Number(url.searchParams.get('page') || '1'));
	const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '50')));
	const offset = (pageNum - 1) * limit;

	let sql = 'SELECT id, org_id, user_id, action, resource_type, resource_id, details, ip_address, created_at FROM audit_logs WHERE org_id = ?';
	const params: unknown[] = [orgId];
	if (filterAction) { sql += " AND action LIKE ? ESCAPE '\\'"; params.push(`%${filterAction}%`); }
	sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
	params.push(limit, offset);

	const result = await db.prepare(sql).bind(...params).all().catch(() => ({ results: [] }));
	const entries = result.results.map((r: any) => ({
		id: r.id, actor: r.user_id ?? 'system', action: r.action,
		resourceType: r.resource_type, resourceId: r.resource_id,
		details: r.details ? JSON.parse(r.details) : null,
		createdAt: r.created_at,
	}));
	return c.json({ entries, total: entries.length, page: pageNum, limit });
});
