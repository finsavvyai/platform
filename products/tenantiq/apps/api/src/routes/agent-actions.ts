/**
 * Agent activity feed for the calling org.
 *
 *   GET /                    — last 100 actions, with optional ?since=epochMs filter
 *   GET /stream              — SSE stream, polls every 5s for new rows since the last sent
 *   GET /summary             — counts by agent, status, severity (last 24h)
 *
 * Org-scoped via JWT. Used by the /agents dashboard so MSPs can see what
 * the autonomous agents are doing across their book in real time.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';

export const agentActionsRoutes = new Hono<AppEnv>();
agentActionsRoutes.use('*', authMiddleware);

interface ActionRow {
	id: string; org_id: string | null; tenant_id: string | null;
	agent: string; action: string; finding_id: string | null;
	severity: string | null; status: string;
	metadata: string | null; created_at: number;
}

agentActionsRoutes.get('/', async (c) => {
	const orgId = c.get('user')?.orgId;
	if (!orgId) return c.json({ error: 'No organization context' }, 400);
	const since = parseInt(c.req.query('since') ?? '0', 10);
	const limit = Math.min(500, Math.max(10, parseInt(c.req.query('limit') ?? '100', 10)));

	const rows = await c.env.DB.prepare(
		`SELECT id, org_id, tenant_id, agent, action, finding_id, severity, status, metadata, created_at
		 FROM agent_actions
		 WHERE org_id = ? AND created_at >= ?
		 ORDER BY created_at DESC LIMIT ?`,
	).bind(orgId, since, limit).all<ActionRow>().catch(() => ({ results: [] as ActionRow[] }));

	return c.json({ actions: (rows.results ?? []).map(shape), generatedAt: new Date().toISOString() });
});

agentActionsRoutes.get('/summary', async (c) => {
	const orgId = c.get('user')?.orgId;
	if (!orgId) return c.json({ error: 'No organization context' }, 400);
	const since = Date.now() - 86_400_000;

	const [byAgent, byStatus, bySeverity, totalRow] = await Promise.all([
		c.env.DB.prepare(`SELECT agent, COUNT(*) AS n FROM agent_actions WHERE org_id = ? AND created_at >= ? GROUP BY agent ORDER BY n DESC`)
			.bind(orgId, since).all<{ agent: string; n: number }>().catch(() => ({ results: [] as { agent: string; n: number }[] })),
		c.env.DB.prepare(`SELECT status, COUNT(*) AS n FROM agent_actions WHERE org_id = ? AND created_at >= ? GROUP BY status`)
			.bind(orgId, since).all<{ status: string; n: number }>().catch(() => ({ results: [] as { status: string; n: number }[] })),
		c.env.DB.prepare(`SELECT severity, COUNT(*) AS n FROM agent_actions WHERE org_id = ? AND created_at >= ? AND severity IS NOT NULL GROUP BY severity`)
			.bind(orgId, since).all<{ severity: string; n: number }>().catch(() => ({ results: [] as { severity: string; n: number }[] })),
		c.env.DB.prepare(`SELECT COUNT(*) AS n FROM agent_actions WHERE org_id = ? AND created_at >= ?`)
			.bind(orgId, since).first<{ n: number }>().catch(() => ({ n: 0 })),
	]);

	return c.json({
		windowHours: 24,
		total: totalRow?.n ?? 0,
		byAgent: byAgent.results ?? [],
		byStatus: byStatus.results ?? [],
		bySeverity: bySeverity.results ?? [],
	});
});

agentActionsRoutes.get('/stream', async (c) => {
	if (!(c.req.header('accept') ?? '').includes('text/event-stream')) {
		return c.json({ error: 'GET requires Accept: text/event-stream' }, 406);
	}
	const orgId = c.get('user')?.orgId;
	if (!orgId) return c.json({ error: 'No organization context' }, 400);

	// Sub-second push via the org's TenantEvents Durable Object. Every
	// logAgentAction writes also fan-out to this DO instance, so the SSE
	// stream sees agent_action events without polling D1.
	if (c.env.TENANT_EVENTS) {
		try {
			const doId = c.env.TENANT_EVENTS.idFromName(`org:${orgId}`);
			const stub = c.env.TENANT_EVENTS.get(doId);
			return await stub.fetch('https://internal/sse', {
				headers: { Accept: 'text/event-stream' },
				signal: c.req.raw.signal,
			});
		} catch (err) {
			console.error('[agent-actions/stream] DO forward failed, falling back to D1 poll', err);
		}
	}

	// D1-poll fallback (no DO bound or DO failed). 5s cadence.
	const start = Date.now();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const enc = new TextEncoder();
			const send = (s: string) => controller.enqueue(enc.encode(s));
			send(`: connected\n\n`);

			let lastTs = start;
			const HEARTBEAT_MS = 30_000;
			const POLL_MS = 5_000;
			const MAX_DURATION_MS = 25 * 60_000;
			let lastBeat = start;

			while (Date.now() - start < MAX_DURATION_MS) {
				await sleep(POLL_MS);
				try {
					const rows = await c.env.DB.prepare(
						`SELECT id, org_id, tenant_id, agent, action, finding_id, severity, status, metadata, created_at
						 FROM agent_actions WHERE org_id = ? AND created_at > ?
						 ORDER BY created_at ASC LIMIT 50`,
					).bind(orgId, lastTs).all<ActionRow>().catch(() => ({ results: [] as ActionRow[] }));
					for (const r of rows.results ?? []) {
						send(`data: ${JSON.stringify(shape(r))}\n\n`);
						lastTs = Math.max(lastTs, r.created_at);
					}
				} catch { /* keep stream alive */ }

				if (Date.now() - lastBeat >= HEARTBEAT_MS) {
					send(`: heartbeat\n\n`);
					lastBeat = Date.now();
				}
			}
			controller.close();
		},
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store, no-transform',
			'x-accel-buffering': 'no',
		},
	});
});

function shape(r: ActionRow) {
	return {
		id: r.id, orgId: r.org_id, tenantId: r.tenant_id,
		agent: r.agent, action: r.action,
		findingId: r.finding_id, severity: r.severity, status: r.status,
		metadata: r.metadata ? safeJson(r.metadata) : null,
		at: new Date(r.created_at).toISOString(),
	};
}
function safeJson(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
