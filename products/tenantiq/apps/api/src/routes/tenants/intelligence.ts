/**
 * Tenant intelligence routes: SDLC, threats, UEBA.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { getDb } from '../../lib/db';
import { getTenantById } from '@tenantiq/db';

export const intelligenceRoutes = new Hono<AppEnv>();

// POST /api/tenants/:id/phishing/scan — AI phishing threat analysis
intelligenceRoutes.post('/:id/phishing/scan', async (c) => {
	const id = c.req.param('id');
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

	const body = await c.req.json().catch(() => ({ timeRangeHours: 24 }));
	const timeRangeHours = body.timeRangeHours || 24;

	const [emailStats, emailConfig] = await Promise.all([
		c.env.KV.get(`email-stats:${id}`, 'json') as Promise<{
			totalEmails?: number; quarantinedEmails?: number; suspiciousLinks?: number;
			spoofedSenders?: number; malwareDetected?: number; userReportedPhishing?: number;
		} | null>,
		c.env.KV.get(`email-config:${id}`, 'json') as Promise<{
			antiPhishingEnabled?: boolean; safeLinksEnabled?: boolean; safeAttachmentsEnabled?: boolean;
			dkimEnabled?: boolean; dmarcEnabled?: boolean;
		} | null>,
	]);

	const emailData = {
		totalEmails: emailStats?.totalEmails || 0,
		quarantinedEmails: emailStats?.quarantinedEmails || 0,
		suspiciousLinks: emailStats?.suspiciousLinks || 0,
		spoofedSenders: emailStats?.spoofedSenders || 0,
		malwareDetected: emailStats?.malwareDetected || 0,
		userReportedPhishing: emailStats?.userReportedPhishing || 0,
		antiPhishingEnabled: emailConfig?.antiPhishingEnabled || false,
		safeLinksEnabled: emailConfig?.safeLinksEnabled || false,
		safeAttachmentsEnabled: emailConfig?.safeAttachmentsEnabled || false,
		dkimEnabled: emailConfig?.dkimEnabled || false,
		dmarcEnabled: emailConfig?.dmarcEnabled || false,
	};

	if (!c.env.AI_ENGINE) return c.json({ error: 'AI engine not configured' }, 503);

	try {
		const response = await c.env.AI_ENGINE.fetch('https://ai-engine/api/m365/phishing-scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ emailData, timeRangeHours }),
		});
		const result = await response.json() as { analysis: unknown; source: string };
		return c.json(result);
	} catch (err) {
		console.error('AI phishing analysis failed:', err);
		return c.json({ error: 'AI analysis failed' }, 500);
	}
});

// GET /api/tenants/:id/sdlc — SDLC.cc AI Compliance config and stats
intelligenceRoutes.get('/:id/sdlc', async (c) => {
	const id = c.req.param('id');
	const cached = await c.env.KV.get(`sdlc:${id}`, 'json') as { config: unknown; stats: unknown } | null;
	if (cached) return c.json(cached);
	return c.json({ config: { enabled: false, proxyUrl: '', piiClasses: [], policies: [] }, stats: null });
});

// POST /api/tenants/:id/sdlc/configure — Enable SDLC.cc
intelligenceRoutes.post('/:id/sdlc/configure', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
	const piiClasses = (body.piiClasses as string[]) || [];
	const policies = (body.policies as string[]) || [];
	const apiKey = (body.apiKey as string) || '';

	const config = { enabled: true, proxyUrl: 'https://proxy.sdlc.cc/v1', piiClasses, policies, hasApiKey: !!apiKey };
	if (apiKey) await c.env.KV.put(`sdlc-key:${id}`, apiKey, { expirationTtl: 86400 * 365 });
	const stats = { totalRequests: 0, redactedRequests: 0, piiDetected: 0, avgLatencyMs: 0, complianceScore: 0, topPiiTypes: [] as any[] };

	await c.env.KV.put(`sdlc:${id}`, JSON.stringify({ config, stats }), { expirationTtl: 86400 * 30 });
	return c.json({ success: true, config, stats });
});

// POST /api/tenants/:id/sdlc/refresh — Pull latest stats from SDLC.cc API
intelligenceRoutes.post('/:id/sdlc/refresh', async (c) => {
	const id = c.req.param('id');
	const cached = await c.env.KV.get(`sdlc:${id}`, 'json') as { config: any; stats: any } | null;
	if (!cached?.config?.enabled) return c.json({ error: 'SDLC not configured' }, 400);

	const apiKey = await c.env.KV.get(`sdlc-key:${id}`) as string | null;
	if (!apiKey) return c.json({ error: 'No API key — add your SDLC.cc API key to pull live stats', code: 'no_key' }, 400);

	try {
		const resp = await fetch('https://api.sdlc.cc/v1/stats', { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
		if (!resp.ok) {
			const errText = await resp.text().catch(() => 'Unknown error');
			return c.json({ error: `SDLC.cc API error (${resp.status}): ${errText}`, code: 'api_error' }, 502);
		}
		const liveStats = await resp.json() as any;
		const stats = {
			totalRequests: liveStats.totalRequests ?? liveStats.total_requests ?? 0,
			redactedRequests: liveStats.redactedRequests ?? liveStats.redacted_requests ?? 0,
			piiDetected: liveStats.piiDetected ?? liveStats.pii_detected ?? 0,
			avgLatencyMs: liveStats.avgLatencyMs ?? liveStats.avg_latency_ms ?? 0,
			complianceScore: liveStats.complianceScore ?? liveStats.compliance_score ?? 0,
			topPiiTypes: liveStats.topPiiTypes ?? liveStats.top_pii_types ?? [],
		};
		const updated = { config: cached.config, stats };
		await c.env.KV.put(`sdlc:${id}`, JSON.stringify(updated), { expirationTtl: 86400 * 30 });
		return c.json({ success: true, stats });
	} catch (err) {
		return c.json({ error: 'Failed to reach SDLC.cc API', code: 'network_error' }, 502);
	}
});

// POST /api/tenants/:id/sdlc/disable — Disable SDLC.cc
intelligenceRoutes.post('/:id/sdlc/disable', async (c) => {
	const id = c.req.param('id');
	await c.env.KV.delete(`sdlc:${id}`);
	await c.env.KV.delete(`sdlc-key:${id}`);
	return c.json({ success: true });
});

// GET /api/tenants/:id/threats — Security alerts + risky users + risk detections
intelligenceRoutes.get('/:id/threats', async (c) => {
	const id = c.req.param('id');
	const { getThreatSummary, sortThreatsBySeverity } = await import('./threats-data');
	const { mapGraphAlerts } = await import('./threat-mapper');
	const { mapRiskDetection, mapDbAlert, groupByTitle } = await import('./threats-aggregator');
	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?').bind(id).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ threats: [], summary: getThreatSummary([]) });

	const { GraphClient } = await import('../../lib/graph-client');
	const { getRiskyUsers, getRiskDetections } = await import('../../lib/graph-client-extended');
	const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);

	const [alerts, riskyUsers, riskDetections, emailStats] = await Promise.all([
		graph.getSecurityAlerts(),
		getRiskyUsers(graph),
		getRiskDetections(graph),
		c.env.KV.get(`email-stats:${id}`, 'json') as Promise<{
			totalEmails?: number; quarantinedEmails?: number; blockedIncoming?: number;
			blockedOutgoing?: number; malwareDetected?: number; spoofedSenders?: number;
		} | null>,
	]);

	const dbAlerts = await c.env.DB.prepare(
		'SELECT id, type, severity, title, description, status, created_at, affected_users, metadata FROM alerts WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50'
	).bind(id, 'active').all().catch(() => ({ results: [] }));

	const raw = [
		...mapGraphAlerts(alerts),
		...riskDetections.map((r: any) => mapRiskDetection(r)),
		...(dbAlerts.results as any[]).map((a: any) => mapDbAlert(a)),
	];

	const allThreats = sortThreatsBySeverity(groupByTitle(raw));

	const quarantine = emailStats ? {
		total: emailStats.quarantinedEmails ?? 0,
		blockedIncoming: emailStats.blockedIncoming ?? emailStats.quarantinedEmails ?? 0,
		blockedOutgoing: emailStats.blockedOutgoing ?? 0,
		malwareDetected: emailStats.malwareDetected ?? 0,
		spoofedSenders: emailStats.spoofedSenders ?? 0,
	} : null;

	return c.json({
		threats: allThreats, riskyUsers, riskDetections,
		quarantine,
		summary: { ...getThreatSummary(allThreats), riskyUserCount: riskyUsers.length, riskDetectionCount: riskDetections.length },
	});
});

// GET /api/tenants/:id/ueba — User behavior analytics with real MFA status
intelligenceRoutes.get('/:id/ueba', async (c) => {
	const id = c.req.param('id');
	const { buildUebaFromUsers, getUebaSummary } = await import('./ueba-data');
	const dbUsers = await c.env.DB.prepare(
		'SELECT display_name, mail, user_principal_name, job_title, last_sign_in_at, account_enabled FROM users_cache WHERE tenant_id = ? ORDER BY last_sign_in_at DESC LIMIT 100'
	).bind(id).all().catch(() => ({ results: [] }));
	const users = buildUebaFromUsers(dbUsers.results as any[]);

	const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(id).first<{ azure_tenant_id: string }>();
	let mfaSummary = { registered: 0, total: 0, percentage: 0 };
	if (tenant?.azure_tenant_id) {
		try {
			const { GraphClient } = await import('../../lib/graph-client');
			const { getMfaRegistrationDetails } = await import('../../lib/graph-client-extended');
			const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
			const mfaDetails = await getMfaRegistrationDetails(graph);
			const registered = mfaDetails.filter((m: any) => m.isMfaRegistered).length;
			mfaSummary = { registered, total: mfaDetails.length, percentage: mfaDetails.length > 0 ? Math.round((registered / mfaDetails.length) * 100) : 0 };
		} catch { /* use default summary */ }
	}

	return c.json({ users, summary: { ...getUebaSummary(users), mfa: mfaSummary } });
});
