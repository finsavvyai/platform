/**
 * MCP Streamable-HTTP transport: server-initiated events over SSE.
 *
 * Client opens `GET /api/mcp` with `Accept: text/event-stream`. We return a
 * long-lived ReadableStream. Every 10s we poll D1 for alerts and config-drift
 * rows newer than the connection's start timestamp and push each one as a
 * JSON-RPC `notifications/message`. Every 30s we send a `:heartbeat` comment
 * so proxies don't kill the connection.
 *
 * Note: this is poll-based, not pub/sub. Good enough for MVP — typical Claude
 * use case checks for events on each turn anyway. A proper Durable-Object
 * fan-out can replace the poll loop later without changing the wire format.
 */
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';

const POLL_INTERVAL_MS = 10_000;
const HEARTBEAT_MS = 30_000;
const MAX_DURATION_MS = 25 * 60_000; // Worker request cap is ~30 min; close before

interface AlertRow {
	id: string; tenant_id: string; severity: string; type: string; title: string; created_at: number;
}
interface DriftRow {
	id: string; tenant_id: string; category: string; severity: string; summary: string; detected_at: string;
}

export async function handleMcpSse(c: Context<AppEnv>): Promise<Response> {
	const orgId = c.get('user')?.orgId ?? '';
	if (!orgId) return c.json({ error: 'No organization context' }, 400);

	const start = Date.now();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (frame: string) => controller.enqueue(encoder.encode(frame));

			send(`: connected\n\n`);
			send(formatMessage({ method: 'notifications/connected', params: { ts: new Date(start).toISOString() } }));

			let lastAlertTs = start;
			let lastDriftTs = start;
			let lastHeartbeat = start;
			const tenants = await listOrgTenantIds(c, orgId);

			while (Date.now() - start < MAX_DURATION_MS) {
				await sleep(POLL_INTERVAL_MS);

				const now = Date.now();
				try {
					const newAlerts = await pollAlerts(c, tenants, lastAlertTs);
					for (const a of newAlerts) {
						send(formatMessage({
							method: 'notifications/message',
							params: {
								level: a.severity, logger: 'tenantiq.alert',
								data: { id: a.id, tenantId: a.tenant_id, type: a.type, title: a.title, createdAt: new Date(a.created_at).toISOString() },
							},
						}));
						lastAlertTs = Math.max(lastAlertTs, a.created_at);
					}

					const newDrifts = await pollDrifts(c, tenants, new Date(lastDriftTs).toISOString());
					for (const d of newDrifts) {
						send(formatMessage({
							method: 'notifications/message',
							params: {
								level: d.severity, logger: 'tenantiq.drift',
								data: { id: d.id, tenantId: d.tenant_id, category: d.category, summary: d.summary, detectedAt: d.detected_at },
							},
						}));
						lastDriftTs = Math.max(lastDriftTs, Date.parse(d.detected_at) || 0);
					}
				} catch {
					// swallow — we'd rather keep the stream alive than 500 mid-flight
				}

				if (now - lastHeartbeat >= HEARTBEAT_MS) {
					send(`: heartbeat\n\n`);
					lastHeartbeat = now;
				}
			}

			send(formatMessage({ method: 'notifications/closed', params: { reason: 'max-duration' } }));
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
}

function formatMessage(notification: { method: string; params: unknown }): string {
	const payload = JSON.stringify({ jsonrpc: '2.0', ...notification });
	return `data: ${payload}\n\n`;
}

async function listOrgTenantIds(c: Context<AppEnv>, orgId: string): Promise<string[]> {
	const rows = await c.env.DB.prepare('SELECT id FROM tenants WHERE org_id = ?')
		.bind(orgId).all<{ id: string }>().catch(() => ({ results: [] as { id: string }[] }));
	return (rows.results ?? []).map((r) => r.id);
}

async function pollAlerts(c: Context<AppEnv>, tenantIds: string[], sinceMs: number): Promise<AlertRow[]> {
	if (tenantIds.length === 0) return [];
	const placeholders = tenantIds.map(() => '?').join(',');
	const rows = await c.env.DB.prepare(
		`SELECT id, tenant_id, severity, type, title, created_at FROM alerts
		 WHERE tenant_id IN (${placeholders}) AND created_at > ?
		 ORDER BY created_at ASC LIMIT 50`,
	).bind(...tenantIds, sinceMs).all<AlertRow>().catch(() => ({ results: [] as AlertRow[] }));
	return rows.results ?? [];
}

async function pollDrifts(c: Context<AppEnv>, tenantIds: string[], sinceIso: string): Promise<DriftRow[]> {
	if (tenantIds.length === 0) return [];
	const placeholders = tenantIds.map(() => '?').join(',');
	const rows = await c.env.DB.prepare(
		`SELECT id, tenant_id, category, severity, summary, detected_at FROM config_drifts
		 WHERE tenant_id IN (${placeholders}) AND detected_at > ?
		 ORDER BY detected_at ASC LIMIT 50`,
	).bind(...tenantIds, sinceIso).all<DriftRow>().catch(() => ({ results: [] as DriftRow[] }));
	return rows.results ?? [];
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
