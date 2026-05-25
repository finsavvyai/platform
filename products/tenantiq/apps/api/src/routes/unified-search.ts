import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

export const unifiedSearchRoutes = new Hono<AppEnv>();

interface SearchResults {
	tenants: Array<{ id: string; name: string; domain: string }>;
	alerts: Array<{ id: string; title: string; severity: string }>;
	controls: Array<{ id: string; title: string; status: string }>;
	workflows: Array<{ id: string; name: string; status: string }>;
}

/** GET /api/search?q=... — Search across tenants, alerts, CIS controls, workflows. */
unifiedSearchRoutes.get('/', async (c) => {
	const query = c.req.query('q')?.trim();
	if (!query || query.length < 2) {
		return c.json({ error: 'Query must be at least 2 characters' }, 400);
	}

	const orgId = c.get('user')?.orgId;
	if (!orgId) return c.json({ error: 'Unauthorized' }, 401);

	const db = c.env.DB;
	const like = `%${query}%`;

	const [tenants, alerts, controls, workflows] = await Promise.all([
		searchTenants(db, orgId, like),
		searchAlerts(db, orgId, like),
		searchControls(db, orgId, like),
		searchWorkflows(db, orgId, like),
	]);

	const results: SearchResults = { tenants, alerts, controls, workflows };
	return c.json({ data: results, query });
});

async function searchTenants(db: D1Database, orgId: string, like: string) {
	try {
		const { results } = await db
			.prepare(
				`SELECT id, display_name AS name, domain
				 FROM tenants
				 WHERE org_id = ? AND (display_name LIKE ? OR domain LIKE ?)
				 LIMIT 10`,
			)
			.bind(orgId, like, like)
			.all();
		return (results ?? []) as Array<{ id: string; name: string; domain: string }>;
	} catch {
		return [];
	}
}

async function searchAlerts(db: D1Database, orgId: string, like: string) {
	try {
		const { results } = await db
			.prepare(
				`SELECT id, title, severity
				 FROM alerts
				 WHERE org_id = ? AND (title LIKE ? OR description LIKE ?)
				 ORDER BY created_at DESC
				 LIMIT 10`,
			)
			.bind(orgId, like, like)
			.all();
		return (results ?? []) as Array<{ id: string; title: string; severity: string }>;
	} catch {
		return [];
	}
}

async function searchControls(db: D1Database, orgId: string, like: string) {
	try {
		const { results } = await db
			.prepare(
				`SELECT id, title, status
				 FROM cis_control_results
				 WHERE org_id = ? AND (title LIKE ? OR control_id LIKE ?)
				 ORDER BY updated_at DESC
				 LIMIT 10`,
			)
			.bind(orgId, like, like)
			.all();
		return (results ?? []) as Array<{ id: string; title: string; status: string }>;
	} catch {
		return [];
	}
}

async function searchWorkflows(db: D1Database, orgId: string, like: string) {
	try {
		const { results } = await db
			.prepare(
				`SELECT id, name, status
				 FROM workflows
				 WHERE org_id = ? AND (name LIKE ? OR description LIKE ?)
				 ORDER BY updated_at DESC
				 LIMIT 10`,
			)
			.bind(orgId, like, like)
			.all();
		return (results ?? []) as Array<{ id: string; name: string; status: string }>;
	} catch {
		return [];
	}
}
