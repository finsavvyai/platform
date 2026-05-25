/**
 * Autonomous Tenant Auditor
 *
 * Every 6 hours: for every active tenant whose org has the autonomous-auditor
 * skill enabled, pick the top 3 unfixed CIS-failing controls (highest severity
 * × age), draft an MSP-branded remediation email via Claude, send it via Resend
 * to the org's notification email, and log every action to agent_actions.
 *
 * Best-effort throughout — one tenant's failure must not block the rest.
 */
import type { Env } from '../app/types';
import { logAgentAction } from '../lib/agent-actions';
import { callAnthropic } from '../lib/ai-anthropic';

const AUDITOR_KV_PREFIX = 'autonomous-auditor:lastrun';
const RUN_COOLDOWN_MS = 5 * 3600_000; // 5h — guards against double-firing

interface TenantRow {
	id: string; org_id: string; display_name: string; status: string;
}

interface ControlRow {
	control_id: string; severity: string; title: string;
	current_value: string | null; remediation_hint: string | null;
}

export async function runAutonomousAuditor(env: Env): Promise<void> {
	const tenants = await env.DB.prepare(
		"SELECT id, org_id, display_name, status FROM tenants WHERE status = 'active' LIMIT 200",
	).all<TenantRow>().catch(() => ({ results: [] as TenantRow[] }));

	for (const t of tenants.results ?? []) {
		try {
			await auditOneTenant(env, t);
		} catch (err) {
			console.error(`[auditor] failed for tenant ${t.id}:`, err);
		}
	}
}

async function auditOneTenant(env: Env, t: TenantRow): Promise<void> {
	const lastRun = await env.KV.get(`${AUDITOR_KV_PREFIX}:${t.id}`);
	if (lastRun && Date.now() - parseInt(lastRun, 10) < RUN_COOLDOWN_MS) return;

	// Skip if the org hasn't activated the auditor skill.
	const skills = await env.KV.get(`skills:${t.id}`, 'json') as Array<{ id: string; status: string }> | null;
	if (!skills?.some((s) => s.id === 'autonomous-auditor' && (s.status === 'active' || s.status === 'trial'))) return;

	const findings = await pickTopFindings(env, t.id);
	if (findings.length === 0) {
		await env.KV.put(`${AUDITOR_KV_PREFIX}:${t.id}`, String(Date.now()), { expirationTtl: 86400 });
		return;
	}

	let emailBody: string | null = null;
	if (env.ANTHROPIC_API_KEY) {
		try {
			const ctx = `Tenant: ${t.display_name}\nFindings:\n${findings.map((f, i) => `${i + 1}. [${f.severity}] ${f.control_id} — ${f.title}\n   Current: ${f.current_value ?? '(none)'}\n   Fix: ${f.remediation_hint ?? '(see portal)'}`).join('\n\n')}`;
			emailBody = await callAnthropic(
				env.ANTHROPIC_API_KEY,
				ctx,
				`Draft a concise (under 200 words) MSP-branded email to the tenant administrator for ${t.display_name}. For each of the 3 findings, give one sentence on impact and the exact next-click action (portal path). End with: "Audited autonomously by TenantIQ — sign in to one-click remediate."`,
			);
		} catch (err) {
			console.error('[auditor] Claude call failed', err);
		}
	}
	emailBody ??= staticBody(t.display_name, findings);

	const recipient = await env.DB.prepare(
		'SELECT notification_email FROM org_branding WHERE org_id = ? LIMIT 1',
	).bind(t.org_id).first<{ notification_email: string | null }>().catch(() => null);

	if (env.RESEND_API_KEY && recipient?.notification_email) {
		try {
			await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${env.RESEND_API_KEY}`,
				},
				body: JSON.stringify({
					from: 'TenantIQ Auditor <auditor@tenantiq.app>',
					to: [recipient.notification_email],
					subject: `[TenantIQ] ${findings.length} findings need attention — ${t.display_name}`,
					text: emailBody,
				}),
			});
			await logAgentAction(env, {
				orgId: t.org_id, tenantId: t.id, agent: 'autonomous-auditor', action: 'email-sent',
				severity: findings[0].severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
				metadata: { findingCount: findings.length, recipient: recipient.notification_email },
			});
		} catch (err) {
			console.error('[auditor] resend failed', err);
		}
	}

	for (const f of findings) {
		await logAgentAction(env, {
			orgId: t.org_id, tenantId: t.id, agent: 'autonomous-auditor', action: 'finding-raised',
			findingId: f.control_id, severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
			metadata: { title: f.title },
		});
	}
	await env.KV.put(`${AUDITOR_KV_PREFIX}:${t.id}`, String(Date.now()), { expirationTtl: 86400 });
}

async function pickTopFindings(env: Env, tenantId: string): Promise<ControlRow[]> {
	const sevWeight = "CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END";
	const rows = await env.DB.prepare(
		`SELECT control_id, severity, title, current_value, remediation_hint
		 FROM cis_control_results
		 WHERE tenant_id = ? AND status IN ('fail', 'partial')
		 ORDER BY ${sevWeight} DESC, last_evaluated_at DESC LIMIT 3`,
	).bind(tenantId).all<ControlRow>().catch(() => ({ results: [] as ControlRow[] }));
	return rows.results ?? [];
}

function staticBody(name: string, findings: ControlRow[]): string {
	const lines = findings.map((f, i) =>
		`${i + 1}. [${f.severity.toUpperCase()}] ${f.control_id} — ${f.title}\n   Fix: ${f.remediation_hint ?? 'See TenantIQ portal'}`,
	).join('\n\n');
	return `Hi,\n\nThe TenantIQ autonomous auditor reviewed ${name} and found ${findings.length} findings worth attention:\n\n${lines}\n\nSign in to TenantIQ to one-click remediate or assign these to a queue.\n\n— Audited autonomously by TenantIQ`;
}
