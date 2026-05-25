/**
 * Time-traveling state reconstruction endpoint.
 *
 *   POST /api/timewarp/:tenantId   body { at: ISO-string }
 *   GET  /api/timewarp/:tenantId/audit-window?at=... — raw audit slice
 *
 * Reads the latest snapshot before `at`, every drift between that snapshot
 * and `at`, and the audit window. Hands them all to lib/timewarp.ts which
 * does the reconstruction.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth';
import { reconstruct, type TimewarpInput } from '../lib/timewarp';

export const timewarpRoutes = new Hono<AppEnv>();
timewarpRoutes.use('*', authMiddleware);

interface SnapRow { id: string; captured_at: string; payload: string }
interface DriftRow { id: string; category: string; severity: string; summary: string; metadata: string | null; detected_at: string }
interface AuditRow { actor: string | null; action: string; resource_type: string | null; created_at: string }

timewarpRoutes.post('/:tenantId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const body = await c.req.json<{ at?: string }>().catch(() => ({} as { at?: string }));
	const atMs = body.at ? Date.parse(body.at) : NaN;
	if (isNaN(atMs)) return c.json({ error: '`at` must be ISO-8601' }, 400);
	if (atMs > Date.now()) return c.json({ error: '`at` cannot be in the future' }, 400);

	const atIso = new Date(atMs).toISOString();

	const [snap, drifts, audits] = await Promise.all([
		c.env.DB.prepare(
			`SELECT id, captured_at, payload FROM config_snapshots
			 WHERE tenant_id = ? AND captured_at <= ?
			 ORDER BY captured_at DESC LIMIT 1`,
		).bind(tenantId, atIso).first<SnapRow>().catch(() => null),
		c.env.DB.prepare(
			`SELECT id, category, severity, summary, metadata, detected_at FROM config_drifts
			 WHERE tenant_id = ? AND detected_at <= ?
			 ORDER BY detected_at ASC LIMIT 200`,
		).bind(tenantId, atIso).all<DriftRow>().catch(() => ({ results: [] as DriftRow[] })),
		c.env.DB.prepare(
			`SELECT actor, action, resource_type, created_at FROM audit_logs
			 WHERE tenant_id = ? AND created_at <= ?
			 ORDER BY created_at DESC LIMIT 100`,
		).bind(tenantId, atIso).all<AuditRow>().catch(() => ({ results: [] as AuditRow[] })),
	]);

	let driftsScoped = drifts.results ?? [];
	if (snap?.captured_at) {
		const since = Date.parse(snap.captured_at);
		driftsScoped = driftsScoped.filter((d) => Date.parse(d.detected_at) >= since);
	}

	const input: TimewarpInput = {
		tenantId, at: atMs,
		snapshot: snap ?? null,
		drifts: driftsScoped,
		audits: audits.results ?? [],
	};
	return c.json(reconstruct(input));
});

timewarpRoutes.get('/:tenantId/audit-window', tenantScopingMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const atIso = c.req.query('at') ?? '';
	const ms = Date.parse(atIso);
	if (isNaN(ms)) return c.json({ error: '`at` query param must be ISO-8601' }, 400);
	const windowSeconds = Math.min(86_400, Math.max(60, parseInt(c.req.query('windowSeconds') ?? '3600', 10)));
	const start = new Date(ms - windowSeconds * 1000).toISOString();
	const end = new Date(ms).toISOString();
	const rows = await c.env.DB.prepare(
		`SELECT actor, action, resource_type, created_at FROM audit_logs
		 WHERE tenant_id = ? AND created_at >= ? AND created_at <= ?
		 ORDER BY created_at DESC LIMIT 200`,
	).bind(tenantId, start, end).all<AuditRow>().catch(() => ({ results: [] as AuditRow[] }));
	return c.json({ tenantId, at: end, windowSeconds, audits: rows.results ?? [] });
});
