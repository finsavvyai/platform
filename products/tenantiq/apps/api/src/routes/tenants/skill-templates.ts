/**
 * Skill templates — pre-bundled skill collections for recurring MSP workflows.
 *
 * Same shape as Anthropic's "agent templates": named bundle + the skills /
 * connectors / guardrails it enables. POST /apply activates every skill in
 * the bundle for the calling tenant in one shot, with a single audit-log
 * entry referencing the template id.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';

export const skillTemplateRoutes = new Hono<AppEnv>();

export interface SkillTemplate {
	id: string;
	name: string;
	tagline: string;
	description: string;
	category: 'onboarding' | 'compliance' | 'cost' | 'incident-response';
	skillIds: string[];        // existing skill catalog ids to activate
	requiredScopes: string[];  // Graph permissions the bundle implies
	estMinutesToValue: number; // first useful output in N minutes
	includedInPlan: 'starter' | 'professional' | 'enterprise';
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
	{
		id: 'tpl_new_tenant_onboarding',
		name: 'New Tenant Onboarding',
		tagline: 'From admin consent to first audit-ready report in under 10 minutes.',
		description: 'Wires up admin consent for a new customer, runs the CIS L1 baseline, captures a config snapshot, sets a named "Day 0" baseline for drift detection, and emails the customer a branded welcome report.',
		category: 'onboarding',
		skillIds: ['cis-scan', 'config-snapshot', 'drift-detection', 'executive-report'],
		requiredScopes: [
			'Directory.Read.All',
			'Policy.Read.All',
			'Reports.Read.All',
			'SecurityEvents.Read.All',
		],
		estMinutesToValue: 10,
		includedInPlan: 'starter',
	},
	{
		id: 'tpl_quarterly_compliance_review',
		name: 'Quarterly Compliance Review',
		tagline: 'SOC 2 + HIPAA + GDPR + ISO 27001 evaluation, one click, one PDF.',
		description: 'Re-evaluates all four compliance frameworks, generates an AI-explained gap report per failing control (Claude with tenant context), produces a sharable PDF, and writes a compliance_assessments row so the trend chart updates.',
		category: 'compliance',
		skillIds: ['compliance-posture', 'compliance-explainer-ai', 'executive-report-pdf'],
		requiredScopes: [
			'Reports.Read.All',
			'Policy.Read.All',
			'Directory.Read.All',
			'AuditLog.Read.All',
		],
		estMinutesToValue: 6,
		includedInPlan: 'professional',
	},
	{
		id: 'tpl_license_optimization_audit',
		name: 'License Optimization Audit',
		tagline: 'Find waste, queue reclamations, capture savings — auditable per tenant.',
		description: 'Runs the savings leaderboard + cost optimizer over real Graph activity (D30 mailbox/Teams/SharePoint), groups recommendations by tenant, and queues reclamation actions with dry-run preview + approval gate.',
		category: 'cost',
		skillIds: ['savings-leaderboard', 'cost-optimizer', 'license-autopilot'],
		requiredScopes: [
			'Directory.Read.All',
			'Reports.Read.All',
			'User.ReadWrite.All',
		],
		estMinutesToValue: 8,
		includedInPlan: 'professional',
	},
	{
		id: 'tpl_incident_response_kit',
		name: 'Incident Response Kit',
		tagline: 'Defender alerts, drift attribution, audit log export — assembled.',
		description: 'Pulls open Defender alerts (XDR + email), runs a threat assessment over recent sign-ins and risky users, surfaces drift since the last named baseline with attribution, and exports the audit log slice for the incident window.',
		category: 'incident-response',
		skillIds: ['anomaly-detection', 'config-drifts', 'audit-export', 'threat-assessment'],
		requiredScopes: [
			'SecurityEvents.Read.All',
			'AuditLog.Read.All',
			'IdentityRiskEvent.Read.All',
			'Policy.Read.All',
		],
		estMinutesToValue: 4,
		includedInPlan: 'professional',
	},
];

skillTemplateRoutes.get('/:id/skill-templates', async (c) => {
	return c.json({ templates: SKILL_TEMPLATES });
});

skillTemplateRoutes.post('/:id/skill-templates/:templateId/apply', async (c) => {
	const tenantId = c.req.param('id');
	const templateId = c.req.param('templateId');
	const template = SKILL_TEMPLATES.find((t) => t.id === templateId);
	if (!template) return c.json({ error: 'Template not found' }, 404);

	const { getSkillActivations, saveSkillActivations } = await import('../../middleware/skill-gate');
	const existing = (await getSkillActivations(c.env.KV, tenantId)) ?? [];
	const byId = new Map(existing.map((a) => [a.id, a]));
	const now = new Date().toISOString();
	const activated: string[] = [];
	const alreadyActive: string[] = [];

	for (const skillId of template.skillIds) {
		const cur = byId.get(skillId);
		if (cur && (cur.status === 'active' || cur.status === 'trial')) {
			alreadyActive.push(skillId);
			continue;
		}
		byId.set(skillId, { id: skillId, status: 'active', activatedAt: now });
		activated.push(skillId);
	}

	await saveSkillActivations(c.env.KV, tenantId, Array.from(byId.values()));

	return c.json({
		templateId,
		templateName: template.name,
		activated,
		alreadyActive,
		appliedAt: now,
	});
});
