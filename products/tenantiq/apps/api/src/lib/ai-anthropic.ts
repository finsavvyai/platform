/**
 * Anthropic API fallback for AI Engine when OpenClaw is not configured.
 * Provides structured security scan, license optimization, and chain analysis.
 */

export interface TenantContext {
	displayName: string;
	domain: string;
	status: string;
	lastSyncAgo: string;
	userCount: number;
	activeUserCount: number;
	inactiveCount: number;
	disabledCount: number;
	guestCount: number;
	mfaDisabledCount: number;
	licenses: Array<{ name: string; consumed: number; enabled: number; costPerUnit: number; unused: number; wastePerMonth: number }>;
	totalSpend: number;
	totalWaste: number;
	alerts: Array<{ severity: string; title: string; status: string }>;
	alertsBySeverity: Record<string, number>;
	activeAlertCount: number;
	cisScore: number | null;
	cisScannedAt: string | null;
}

export function buildContextString(ctx: TenantContext): string {
	const licLines = ctx.licenses
		.filter(l => l.enabled > 0)
		.map(l => {
			const waste = l.wastePerMonth > 0 ? ` — ${l.unused} unused = $${l.wastePerMonth}/mo waste` : '';
			return `- ${l.name}: ${l.consumed}/${l.enabled} assigned ($${l.costPerUnit}/user/mo)${waste}`;
		}).join('\n');

	const sevParts = ['critical', 'high', 'medium', 'low']
		.filter(s => ctx.alertsBySeverity[s])
		.map(s => `${ctx.alertsBySeverity[s]} ${s}`);

	const recentAlerts = ctx.alerts
		.filter(a => a.status === 'active')
		.slice(0, 5)
		.map(a => `[${a.severity}] ${a.title}`)
		.join(', ');

	const cis = ctx.cisScore != null
		? `CIS Score: ${ctx.cisScore}/100 (last scan: ${ctx.cisScannedAt || 'unknown'})`
		: 'CIS Score: No scan yet';

	return `Tenant: ${ctx.displayName} (${ctx.domain})
Last Sync: ${ctx.lastSyncAgo}

Users: ${ctx.userCount} total, ${ctx.activeUserCount} active, ${ctx.inactiveCount} inactive (90d+), ${ctx.disabledCount} disabled, ${ctx.guestCount} guests
License SKUs:
${licLines || '(none)'}
Total Spend: $${ctx.totalSpend.toFixed(0)}/mo | Total Waste: $${ctx.totalWaste.toFixed(0)}/mo

Alerts: ${sevParts.join(', ') || 'none'} (${ctx.activeAlertCount} active)
${recentAlerts ? `Recent: ${recentAlerts}` : ''}
${cis}`;
}

export const EXPERT_SYSTEM = `You are a Microsoft 365 security and cost intelligence expert inside TenantIQ.

You have access to REAL-TIME tenant data provided below — this is live data from the customer's M365 environment, not sample data.

Rules:
- ALWAYS reference exact numbers from the tenant data (user counts, license counts, dollar amounts, alert counts).
- When asked about licenses, quote exact SKU names, assigned/total counts, cost per unit, and waste amounts.
- When asked about users, quote exact active/inactive/disabled/guest counts.
- Suggest SPECIFIC actions with measurable impact (e.g. "Remove 20 unused ENTERPRISEPACK licenses to save $720/mo").
- Never say "review your policies" — instead say exactly which policy, what the gap is, and what to do.
- If data is missing or a scan hasn't run, say so and suggest the user trigger the relevant scan.
- Keep responses concise but data-rich. Use bullet points for action items.`;

export async function callAnthropic(apiKey: string, context: string, question: string): Promise<string> {
	return callApi(apiKey, EXPERT_SYSTEM, `${context}\n\nQuestion: ${question}`);
}

export async function runSecurityScan(apiKey: string, ctx: TenantContext) {
	const text = await callApi(apiKey, SECURITY_SYSTEM, `Analyze security posture:\n${buildContextString(ctx)}`, SECURITY_SCHEMA);
	return parseSecurityJson(text, ctx);
}

export async function runLicenseOptimize(apiKey: string, ctx: TenantContext) {
	const text = await callApi(apiKey, LICENSE_SYSTEM, `Analyze license efficiency:\n${buildContextString(ctx)}`, LICENSE_SCHEMA);
	return parseLicenseJson(text, ctx);
}

export async function runChain(apiKey: string, preset: string, contextStr: string): Promise<string> {
	return callAnthropic(apiKey, contextStr, CHAIN_PROMPTS[preset] || CHAIN_PROMPTS['full-assessment']);
}

async function callApi(apiKey: string, system: string, userMsg: string, schema?: object): Promise<string> {
	const { AI } = await import('./constants');
	// 25s client timeout — stays inside the CF Worker 30s wall so the error
	// surfaces as a clean AbortError instead of a platform kill.
	const ctrl = new AbortController();
	const timeoutId = setTimeout(() => ctrl.abort(), 25_000);
	try {
		const body: Record<string, unknown> = { model: AI.MODEL, max_tokens: AI.MAX_TOKENS_DEFAULT, system, messages: [{ role: 'user', content: userMsg }] };
		if (schema) body.output_config = { format: { type: 'json_schema', schema } };
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': AI.API_VERSION },
			body: JSON.stringify(body),
			signal: ctrl.signal,
		});
		const data = (await res.json()) as { content?: Array<{ text?: string }> };
		return data.content?.[0]?.text ?? 'Unable to get AI response';
	} finally {
		clearTimeout(timeoutId);
	}
}

// ─── Parsers with data-driven fallbacks ─────────────────────────────────────

export const SECURITY_SYSTEM = `You are a M365 security analyst. Base riskScore (0-100) on ACTUAL data — never default to 50.`;

export const LICENSE_SYSTEM = `You are a M365 license optimization specialist. Calculate wastedLicenses and estimatedMonthlySavings from actual data.`;

export { SECURITY_SCHEMA, LICENSE_SCHEMA } from './ai-anthropic-schemas';
import { SECURITY_SCHEMA, LICENSE_SCHEMA } from './ai-anthropic-schemas';

export const CHAIN_PROMPTS: Record<string, string> = {
	'security-audit': 'Comprehensive security audit: executive summary, risk score, critical findings, MFA analysis, inactive user risks, prioritized remediation steps.',
	'compliance-check': 'Compliance assessment against CIS M365 Benchmarks, SOC 2, GDPR. Compliant areas, gaps, remediation per framework.',
	'cost-review': 'License cost analysis. Waste from inactive users, over-provisioned SKUs. Specific dollar savings per recommendation.',
	'full-assessment': 'Complete executive assessment: 1) Security posture with risk score, 2) License optimization with savings, 3) Compliance gaps, 4) Top 5 priorities by impact. Use actual numbers.',
};

export function parseSecurityJson(text: string, ctx: TenantContext) {
	try {
		const m = text.match(/\{[\s\S]*\}/);
		if (m) { const p = JSON.parse(m[0]); if (typeof p.riskScore === 'number' && Array.isArray(p.criticalFindings)) return p; }
	} catch { /* fall through */ }

	const critical = ctx.alertsBySeverity['critical'] || 0;
	let risk = 20;
	if (ctx.mfaDisabledCount > 0) risk += Math.min(30, ctx.mfaDisabledCount * 5);
	if (critical > 0) risk += Math.min(25, critical * 8);
	if (ctx.inactiveCount > ctx.userCount * 0.2) risk += 15;
	if (ctx.guestCount > ctx.userCount * 0.3) risk += 10;

	const findings: string[] = [];
	if (ctx.mfaDisabledCount > 0) findings.push(`${ctx.mfaDisabledCount} disabled accounts — orphaned access risk`);
	if (critical > 0) findings.push(`${critical} critical alerts unresolved`);
	if (ctx.inactiveCount > 0) findings.push(`${ctx.inactiveCount} inactive users (90d+) with active licenses`);
	if (ctx.guestCount > 0) findings.push(`${ctx.guestCount} guest users — review external access`);
	if (!findings.length) findings.push('No critical issues — continue monitoring');

	const recs: string[] = [];
	if (ctx.mfaDisabledCount > 0) recs.push(`Re-enable or remove ${ctx.mfaDisabledCount} disabled accounts`);
	if (ctx.inactiveCount > 0) recs.push(`Decommission ${ctx.inactiveCount} inactive accounts to save $${ctx.totalWaste.toFixed(0)}/mo`);
	if (critical > 0) recs.push(`Resolve ${critical} critical alerts immediately`);
	if (ctx.guestCount > 0) recs.push(`Audit ${ctx.guestCount} guest permissions and remove stale guests`);
	recs.push('Enable Conditional Access for all admins');

	return { riskScore: Math.min(100, risk), criticalFindings: findings, recommendations: recs, complianceGaps: ctx.mfaDisabledCount > 0 ? ['Disabled accounts still present'] : [], estimatedRemediationHours: Math.max(2, findings.length * 4) };
}

export function parseLicenseJson(text: string, ctx: TenantContext) {
	try {
		const m = text.match(/\{[\s\S]*\}/);
		if (m) { const p = JSON.parse(m[0]); if (typeof p.wastedLicenses === 'number') return p; }
	} catch { /* fall through */ }

	const totalUnused = ctx.licenses.reduce((s, l) => s + l.unused, 0);
	const inactiveWaste = Math.min(ctx.inactiveCount, ctx.licenses.reduce((s, l) => s + l.consumed, 0));
	const wasted = totalUnused + inactiveWaste;

	const recs: Array<{ action: string; priority: string }> = [];
	if (inactiveWaste > 0) recs.push({ action: `Remove licenses from ${inactiveWaste} inactive users`, priority: 'high' });
	for (const l of ctx.licenses) {
		if (l.unused > 0 && l.costPerUnit > 0) recs.push({ action: `${l.name}: reclaim ${l.unused} unused licenses — save $${l.wastePerMonth}/mo`, priority: l.wastePerMonth > 100 ? 'high' : 'medium' });
	}
	if (!recs.length) recs.push({ action: 'License allocation efficient — no action needed', priority: 'low' });

	return { wastedLicenses: wasted, estimatedMonthlySavings: ctx.totalWaste, recommendations: recs };
}
