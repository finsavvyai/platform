/**
 * MCP prompts surface for TenantIQ.
 *
 * Each TenantIQ skill template + a few posture-explainer presets are exposed
 * as Claude prompts via prompts/list + prompts/get. Lets a user say "Run the
 * onboarding template on tenant Acme" and Claude pulls the structured prompt
 * (with the right tool-call wrapper) instead of free-styling it.
 *
 * Spec: https://modelcontextprotocol.io/specification/server/prompts
 */

export interface McpPromptArg {
	name: string;
	description: string;
	required?: boolean;
}

export interface McpPromptDef {
	name: string;
	description: string;
	arguments: McpPromptArg[];
}

export interface McpPromptMessage {
	role: 'user' | 'assistant';
	content: { type: 'text'; text: string };
}

export const PROMPTS: McpPromptDef[] = [
	{
		name: 'onboard_tenant',
		description: 'Run the New Tenant Onboarding template — admin consent, baseline CIS scan, snapshot, welcome report.',
		arguments: [
			{ name: 'tenantId', description: 'TenantIQ tenant id (use list_tenants to find it)', required: true },
		],
	},
	{
		name: 'quarterly_compliance_review',
		description: 'Re-evaluate SOC 2 + HIPAA + GDPR + ISO 27001 with AI gap-by-gap explainer + PDF.',
		arguments: [
			{ name: 'tenantId', description: 'TenantIQ tenant id', required: true },
		],
	},
	{
		name: 'license_optimization_audit',
		description: 'Find waste from real Graph activity (D30) and queue reclamations with dry-run preview.',
		arguments: [
			{ name: 'tenantId', description: 'TenantIQ tenant id', required: true },
		],
	},
	{
		name: 'incident_response_kit',
		description: 'Pull open Defender alerts, threat assessment, drift attribution, audit-log export for the incident window.',
		arguments: [
			{ name: 'tenantId', description: 'TenantIQ tenant id', required: true },
		],
	},
	{
		name: 'explain_posture_gap',
		description: 'Explain a single posture finding (CIS / SOC2 / HIPAA / GDPR / ISO27001) in plain English, with the exact admin action to close it.',
		arguments: [
			{ name: 'tenantId', description: 'TenantIQ tenant id', required: true },
			{ name: 'controlId', description: 'Control id, e.g. CIS-2.1.4 or HIPAA-164.312a', required: true },
			{ name: 'framework', description: 'CIS | SOC 2 | HIPAA | GDPR | ISO 27001', required: false },
		],
	},
	{
		name: 'qbr_summary',
		description: 'Generate a tenant-specific QBR-ready summary covering posture deltas, drift events, license trends, and recommended next-quarter actions.',
		arguments: [
			{ name: 'tenantId', description: 'TenantIQ tenant id', required: true },
			{ name: 'lookbackDays', description: 'How far back to summarise (default 90)', required: false },
		],
	},
];

export function getPromptMessages(name: string, args: Record<string, string>): McpPromptMessage[] | null {
	const tenantId = args.tenantId ?? '<missing-tenantId>';

	switch (name) {
		case 'onboard_tenant':
			return [
				{ role: 'user', content: { type: 'text', text:
					`Run the TenantIQ "New Tenant Onboarding" template on tenant ${tenantId}.\n\n` +
					`Steps:\n` +
					`1. Confirm admin consent has been granted (resource: tenantiq://org/overview).\n` +
					`2. Trigger a CIS L1 baseline scan.\n` +
					`3. Capture a config snapshot and label it "Day 0".\n` +
					`4. Generate a welcome PDF report for the customer.\n\n` +
					`Use the apply_skill_template tool with templateId="tpl_new_tenant_onboarding" to activate the bundle, then call get_cis_posture to confirm the baseline. Surface findings ≥ high to me before I send the welcome report.`,
				} },
			];

		case 'quarterly_compliance_review':
			return [
				{ role: 'user', content: { type: 'text', text:
					`Run the TenantIQ "Quarterly Compliance Review" template on tenant ${tenantId}.\n\n` +
					`1. Call apply_skill_template with templateId="tpl_quarterly_compliance_review".\n` +
					`2. Pull get_compliance_posture and identify every fail/partial control across SOC 2, HIPAA, GDPR, ISO 27001.\n` +
					`3. For each gap: in 2-3 sentences explain (a) what auditors look for, (b) why this tenant fails, (c) the exact M365 admin path to close it. Cite tenantiq://schema/finding when describing structure.\n` +
					`4. Output a single review document grouped by framework.`,
				} },
			];

		case 'license_optimization_audit':
			return [
				{ role: 'user', content: { type: 'text', text:
					`Run the TenantIQ "License Optimization Audit" template on tenant ${tenantId}.\n\n` +
					`1. apply_skill_template with templateId="tpl_license_optimization_audit".\n` +
					`2. Identify unused / under-utilised seats from D30 Graph activity.\n` +
					`3. Classify each as: reclaim (idle 60d+), downgrade (E5→E3 candidate), or keep.\n` +
					`4. Produce a remediation queue with dry-run preview — do NOT auto-apply; queue for admin approval.`,
				} },
			];

		case 'incident_response_kit':
			return [
				{ role: 'user', content: { type: 'text', text:
					`Activate the TenantIQ "Incident Response Kit" for tenant ${tenantId}.\n\n` +
					`1. apply_skill_template with templateId="tpl_incident_response_kit".\n` +
					`2. Pull list_open_alerts and list_recent_drift (sinceHours=72).\n` +
					`3. Cross-reference: are any drift events tied to compromised actors flagged in the alerts?\n` +
					`4. Produce a one-page incident summary: timeline, suspicious actors, suggested containment actions (do NOT acknowledge anything yet).`,
				} },
			];

		case 'explain_posture_gap': {
			const controlId = args.controlId ?? '<missing-controlId>';
			const framework = args.framework ?? 'auto-detect';
			return [
				{ role: 'user', content: { type: 'text', text:
					`Explain ${framework} control ${controlId} for tenant ${tenantId}.\n\n` +
					`Use get_cis_posture or get_compliance_posture to pull the current state. In 4-6 sentences:\n` +
					`(a) What auditors look for in this control.\n` +
					`(b) Why this specific tenant is non-compliant given the data.\n` +
					`(c) The exact M365 admin click path to close the gap (portal → menu → setting), not "review your policies".\n` +
					`(d) Cross-reference equivalent controls in other frameworks if any.`,
				} },
			];
		}

		case 'qbr_summary': {
			const lookback = args.lookbackDays ?? '90';
			return [
				{ role: 'user', content: { type: 'text', text:
					`Generate a QBR-ready summary for tenant ${tenantId} covering the last ${lookback} days.\n\n` +
					`1. Posture deltas: pull get_cis_posture and compare to the value ${lookback}d ago (from the trend resource).\n` +
					`2. Drift events: list_recent_drift sinceHours=${parseInt(lookback, 10) * 24}.\n` +
					`3. License trends: which SKUs grew/shrunk; any reclamations applied.\n` +
					`4. Recommended next-quarter actions: top 3, ranked by impact, each with an owner suggestion.\n\n` +
					`Output: 1-page document, executive tone, no jargon. End with an "Action Items" list the MSP can copy into the customer's QBR deck.`,
				} },
			];
		}

		default:
			return null;
	}
}
