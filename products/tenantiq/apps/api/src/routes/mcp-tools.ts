/**
 * MCP tool catalog + dispatcher for TenantIQ.
 *
 * Tools are split read/write. Read tools are safe by default. Write tools
 * mutate state and check that the calling user has the right role.
 *
 * Spec: https://modelcontextprotocol.io/specification/server/tools
 */
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { DEMO_ORG_ID, DEMO_TENANTS, DEMO_CIS_POSTURE, DEMO_DRIFT_EVENTS } from '../lib/mcp-demo-key';

export interface McpToolDef {
	name: string;
	description: string;
	inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
	annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean };
}

const READ_ONLY = { readOnlyHint: true } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false } as const;

const T_ID = { type: 'string', description: 'TenantIQ tenant id' } as const;

export const TOOLS: McpToolDef[] = [
	// ─── read ──────────────────────────────────────────────────────────────
	{ name: 'list_tenants', description: 'List every Azure AD tenant the calling MSP has connected.',
		inputSchema: { type: 'object', properties: {} }, annotations: READ_ONLY },
	{ name: 'get_cis_posture', description: 'Get CIS Microsoft 365 Foundations Benchmark v3.1 posture for a tenant.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'get_compliance_posture', description: 'Get SOC 2 / HIPAA / GDPR / ISO 27001 posture.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'get_intune_posture', description: 'Get Intune endpoint posture: devices, compliance + MAM policies.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'get_pim_audit', description: 'Get Privileged Identity audit: standing privileged + perpetual + MFA gaps.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'get_defender_coverage', description: 'Defender XDR coverage from Secure Score control profiles.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'list_recent_drift', description: 'Recent configuration drift events with actor attribution.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID, sinceHours: { type: 'number' } }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'get_msp_backup_health', description: 'Cross-tenant backup health rollup for the MSP (every customer in the book).',
		inputSchema: { type: 'object', properties: {} }, annotations: READ_ONLY },
	{ name: 'list_open_alerts', description: 'List open security alerts for a tenant, severity-ordered.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID, limit: { type: 'number' } }, required: ['tenantId'] }, annotations: READ_ONLY },
	{ name: 'list_active_skills', description: 'List skills currently active or trialing on a tenant.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID }, required: ['tenantId'] }, annotations: READ_ONLY },

	// ─── write (mutate state, role-gated) ──────────────────────────────────
	{ name: 'acknowledge_alert', description: 'Acknowledge an open security alert.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID, alertId: { type: 'string' } }, required: ['tenantId', 'alertId'] }, annotations: WRITE },
	{ name: 'acknowledge_drift', description: 'Acknowledge a config drift event so it stops surfacing in the dashboard.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID, driftId: { type: 'string' } }, required: ['tenantId', 'driftId'] }, annotations: WRITE },
	{ name: 'apply_skill_template', description: 'Apply a TenantIQ agent template (bundle of skills) to a tenant.',
		inputSchema: { type: 'object', properties: { tenantId: T_ID, templateId: { type: 'string', description: 'e.g. tpl_new_tenant_onboarding' } }, required: ['tenantId', 'templateId'] }, annotations: WRITE },
];

export async function dispatchTool(
	c: Context<AppEnv>,
	name: string,
	args: Record<string, unknown>,
): Promise<string> {
	const user = c.get('user');
	const orgId = user?.orgId ?? '';
	const role = user?.role ?? '';
	const tenantId = String(args.tenantId ?? c.get('tenantId') ?? '');

	const isDemo = orgId === DEMO_ORG_ID;

	switch (name) {
		case 'list_tenants': {
			if (isDemo) return JSON.stringify({ tenants: DEMO_TENANTS, demo: true }, null, 2);
			const rows = await c.env.DB.prepare(
				'SELECT id, display_name, domain, status, last_sync_at FROM tenants WHERE org_id = ?',
			).bind(orgId).all().catch(() => ({ results: [] }));
			return JSON.stringify({ tenants: rows.results }, null, 2);
		}
		case 'get_cis_posture':
			if (isDemo) return DEMO_CIS_POSTURE;
			return tryFetch(c, `cis:${tenantId}:latest`, 'No CIS scan available — run /api/cis-benchmark/scan first');
		case 'get_compliance_posture':
			return tryFetch(c, `compliance:${tenantId}:latest`, 'No compliance assessment cached — call /api/compliance-posture/frameworks first');
		case 'get_intune_posture':
			return tryFetch(c, `intune:scan:${tenantId}`, 'No Intune scan cached — call /api/intune/scan first');
		case 'get_pim_audit':
			return tryFetch(c, `pim:scan:${tenantId}`, 'No PIM scan cached — call /api/pim/scan first');
		case 'get_defender_coverage':
			return tryFetch(c, `defender:scan:${tenantId}`, 'No Defender scan cached — call /api/defender/scan first');

		case 'list_recent_drift': {
			if (isDemo) return DEMO_DRIFT_EVENTS;
			const sinceHours = Number(args.sinceHours ?? 168);
			const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
			const rows = await c.env.DB.prepare(
				'SELECT id, category, severity, summary, attributed_actor, detected_at FROM config_drifts WHERE tenant_id = ? AND detected_at >= ? ORDER BY detected_at DESC LIMIT 50',
			).bind(tenantId, since).all().catch(() => ({ results: [] }));
			return JSON.stringify({ drifts: rows.results, windowHours: sinceHours }, null, 2);
		}
		case 'get_msp_backup_health': {
			const rows = await c.env.DB.prepare(
				'SELECT id, display_name, domain, status FROM tenants WHERE org_id = ?',
			).bind(orgId).all<{ id: string; display_name: string; domain: string | null; status: string }>().catch(() => ({ results: [] }));
			const summary: Array<Record<string, unknown>> = [];
			for (const t of rows.results ?? []) {
				const latest = await c.env.KV.get(`backup:${t.id}:latest`, 'json') as { timestamp?: string; size?: number } | null;
				summary.push({ tenantId: t.id, name: t.display_name, lastBackupAt: latest?.timestamp ?? null, sizeBytes: latest?.size ?? 0, status: t.status });
			}
			return JSON.stringify({ tenants: summary }, null, 2);
		}
		case 'list_open_alerts': {
			const limit = Math.min(100, Number(args.limit ?? 25));
			const rows = await c.env.DB.prepare(
				`SELECT id, severity, type, title, status, created_at FROM alerts
				 WHERE tenant_id = ? AND status IN ('active','open','new') ORDER BY created_at DESC LIMIT ?`,
			).bind(tenantId, limit).all().catch(() => ({ results: [] }));
			return JSON.stringify({ alerts: rows.results }, null, 2);
		}
		case 'list_active_skills': {
			const raw = await c.env.KV.get(`skills:${tenantId}`, 'json') as Array<{ id: string; status: string; activatedAt: string }> | null;
			const active = (raw ?? []).filter((s) => s.status === 'active' || s.status === 'trial');
			return JSON.stringify({ activeSkills: active }, null, 2);
		}

		case 'acknowledge_alert': {
			if (!isWriteRole(role)) return JSON.stringify({ error: 'Forbidden — requires admin / tenant_admin / tenant_engineer role' });
			const alertId = String(args.alertId ?? '');
			if (!alertId) return JSON.stringify({ error: 'alertId required' });
			await c.env.DB.prepare(
				'UPDATE alerts SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
			).bind('acknowledged', new Date().toISOString(), alertId, tenantId).run();
			return JSON.stringify({ ok: true, alertId, action: 'acknowledged' });
		}
		case 'acknowledge_drift': {
			if (!isWriteRole(role)) return JSON.stringify({ error: 'Forbidden — requires admin / tenant_admin / tenant_engineer role' });
			const driftId = String(args.driftId ?? '');
			if (!driftId) return JSON.stringify({ error: 'driftId required' });
			await c.env.DB.prepare(
				'UPDATE config_drifts SET acknowledged_at = ? WHERE id = ? AND tenant_id = ?',
			).bind(new Date().toISOString(), driftId, tenantId).run();
			return JSON.stringify({ ok: true, driftId, action: 'acknowledged' });
		}
		case 'apply_skill_template': {
			if (!isWriteRole(role)) return JSON.stringify({ error: 'Forbidden — requires admin / tenant_admin role' });
			const templateId = String(args.templateId ?? '');
			if (!templateId) return JSON.stringify({ error: 'templateId required' });
			const { SKILL_TEMPLATES } = await import('./tenants/skill-templates');
			const tpl = SKILL_TEMPLATES.find((t) => t.id === templateId);
			if (!tpl) return JSON.stringify({ error: `Unknown template: ${templateId}` });
			const { getSkillActivations, saveSkillActivations } = await import('../middleware/skill-gate');
			const existing = (await getSkillActivations(c.env.KV, tenantId)) ?? [];
			const byId = new Map(existing.map((a) => [a.id, a]));
			const now = new Date().toISOString();
			const activated: string[] = [];
			for (const sid of tpl.skillIds) {
				if (byId.get(sid)?.status === 'active' || byId.get(sid)?.status === 'trial') continue;
				byId.set(sid, { id: sid, status: 'active', activatedAt: now });
				activated.push(sid);
			}
			await saveSkillActivations(c.env.KV, tenantId, Array.from(byId.values()));
			return JSON.stringify({ ok: true, templateId, activated, appliedAt: now });
		}

		default:
			return JSON.stringify({ error: `Unhandled tool: ${name}` });
	}
}

function isWriteRole(role: string): boolean {
	return ['admin', 'super_admin', 'platform_admin', 'tenant_admin', 'tenant_engineer'].includes(role);
}

async function tryFetch(c: Context<AppEnv>, key: string, fallback: string): Promise<string> {
	const cached = await c.env.KV.get(key);
	return cached ?? fallback;
}
