/**
 * Governance / AI usage proxy.
 *
 * Surfaces sdlc.cc's /v1/audit/usage to the TenantIQ web console so
 * MSP admins see per-tenant AI consumption (token spend, DLP hits,
 * provider mix) without us re-implementing the aggregation. We hold
 * the SDLC_CC_ADMIN_BEARER server-side; the browser never sees it.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

export const governanceAiRoutes = new Hono<AppEnv>();

interface UsageResponse {
	total_requests: number;
	total_cost_usd_micros: number;
	by_provider: Array<{ key: string; count: number; cost_usd_micros: number }>;
	by_status: Array<{ key: string; count: number }>;
	rows: unknown[];
}

const DEFAULT_BASE = 'https://api.sdlc.cc';

/**
 * GET /api/governance/ai-usage?tenant_id=...&since=...&until=...
 *
 * Forwards the query params verbatim to sdlc.cc, attaches the admin
 * bearer, returns the JSON. When the env vars aren't set we return
 * a structured empty response so the UI renders an honest "not
 * connected" state rather than throwing.
 */
governanceAiRoutes.get('/ai-usage', async (c) => {
	const env = c.env;
	if (!env.SDLC_CC_ADMIN_BEARER) {
		return c.json<UsageResponse>({
			total_requests: 0,
			total_cost_usd_micros: 0,
			by_provider: [],
			by_status: [],
			rows: [],
		});
	}

	const base = env.SDLC_CC_BASE_URL?.replace(/\/v1\/messages$/, '') ?? DEFAULT_BASE;
	const qs = new URLSearchParams();
	const tenantId = c.req.query('tenant_id') ?? c.get('tenantId');
	if (tenantId) qs.set('tenant_id', tenantId);
	const since = c.req.query('since');
	const until = c.req.query('until');
	if (since) qs.set('since', since);
	if (until) qs.set('until', until);

	const upstream = await fetch(`${base}/v1/audit/usage?${qs.toString()}`, {
		headers: { Authorization: `Bearer ${env.SDLC_CC_ADMIN_BEARER}` },
	});

	if (!upstream.ok) {
		return c.json({ error: `sdlc.cc HTTP ${upstream.status}` }, 502);
	}
	const body = (await upstream.json()) as UsageResponse;
	return c.json(body);
});
