/**
 * Public, anonymized stats. No auth, no PII — just aggregate counters
 * pulled from agent_actions, prospect_leads, and a couple of static rows.
 *
 * Powers the live counter on the marketing landing. KV-cached 60s so this
 * doesn't melt under viral traffic.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

export const statsPublicRoutes = new Hono<AppEnv>();

const CACHE_KEY = 'public:stats:v1';
const CACHE_TTL = 60;

interface StatsResponse {
	totalScans: number;
	totalControlsAudited: number;
	totalFindings: number;
	totalAutonomousFixes: number;
	totalDriftReverts: number;
	last7dScans: number;
	last30dActions: number;
	asOf: string;
}

statsPublicRoutes.get('/', async (c) => {
	const cached = await c.env.KV.get(CACHE_KEY, 'json') as StatsResponse | null;
	if (cached) return c.json(cached, 200, { 'cache-control': 'public, max-age=60' });

	const now = Date.now();
	const dayMs = 86_400_000;
	const stats = await loadStats(c.env, now, dayMs);

	await c.env.KV.put(CACHE_KEY, JSON.stringify(stats), { expirationTtl: CACHE_TTL });
	return c.json(stats, 200, { 'cache-control': 'public, max-age=60' });
});

statsPublicRoutes.get('/leaderboard', async (c) => {
	const now = Date.now();
	const since = now - 7 * 86_400_000;
	const [byAgent, bySeverity, byAction] = await Promise.all([
		c.env.DB.prepare(
			`SELECT agent, COUNT(*) AS n FROM agent_actions WHERE created_at >= ? GROUP BY agent ORDER BY n DESC LIMIT 10`,
		).bind(since).all<{ agent: string; n: number }>().catch(() => ({ results: [] as { agent: string; n: number }[] })),
		c.env.DB.prepare(
			`SELECT severity, COUNT(*) AS n FROM agent_actions WHERE created_at >= ? AND severity IS NOT NULL GROUP BY severity`,
		).bind(since).all<{ severity: string; n: number }>().catch(() => ({ results: [] as { severity: string; n: number }[] })),
		c.env.DB.prepare(
			`SELECT action, COUNT(*) AS n FROM agent_actions WHERE created_at >= ? GROUP BY action ORDER BY n DESC`,
		).bind(since).all<{ action: string; n: number }>().catch(() => ({ results: [] as { action: string; n: number }[] })),
	]);
	return c.json({
		windowDays: 7,
		byAgent: byAgent.results ?? [],
		bySeverity: bySeverity.results ?? [],
		byAction: byAction.results ?? [],
		generatedAt: new Date(now).toISOString(),
	}, 200, { 'cache-control': 'public, max-age=120' });
});

async function loadStats(env: AppEnv['Bindings'], now: number, dayMs: number): Promise<StatsResponse> {
	const [
		totalScansRow, totalFindingsRow, totalFixesRow, totalRevertsRow,
		last7dScansRow, last30dActionsRow, totalControlsRow,
	] = await Promise.all([
		env.DB.prepare("SELECT COUNT(*) AS n FROM agent_actions WHERE action = 'scan'").first<{ n: number }>(),
		env.DB.prepare("SELECT COUNT(*) AS n FROM agent_actions WHERE action = 'finding-raised'").first<{ n: number }>(),
		env.DB.prepare("SELECT COUNT(*) AS n FROM agent_actions WHERE action = 'fix-applied'").first<{ n: number }>(),
		env.DB.prepare("SELECT COUNT(*) AS n FROM agent_actions WHERE action = 'drift-reverted'").first<{ n: number }>(),
		env.DB.prepare("SELECT COUNT(*) AS n FROM agent_actions WHERE action = 'scan' AND created_at >= ?")
			.bind(now - 7 * dayMs).first<{ n: number }>(),
		env.DB.prepare('SELECT COUNT(*) AS n FROM agent_actions WHERE created_at >= ?')
			.bind(now - 30 * dayMs).first<{ n: number }>(),
		env.DB.prepare('SELECT COUNT(*) AS n FROM cis_scans').first<{ n: number }>().catch(() => ({ n: 0 })),
	].map((p) => p.catch(() => ({ n: 0 }))));

	return {
		totalScans: totalScansRow?.n ?? 0,
		totalControlsAudited: (totalControlsRow?.n ?? 0) * 121, // each cis_scan audits the full 121-control catalog
		totalFindings: totalFindingsRow?.n ?? 0,
		totalAutonomousFixes: totalFixesRow?.n ?? 0,
		totalDriftReverts: totalRevertsRow?.n ?? 0,
		last7dScans: last7dScansRow?.n ?? 0,
		last30dActions: last30dActionsRow?.n ?? 0,
		asOf: new Date(now).toISOString(),
	};
}
