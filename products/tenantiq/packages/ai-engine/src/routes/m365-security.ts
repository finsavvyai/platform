/**
 * TenantIQ AI Engine — M365 Security Scan & License Optimize Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { callAnthropic, getBestLLMClient } from '../lib/llm';
import { getOpenClawBridge } from '../helpers';
import type { Bindings } from '../types';

const m365Security = new Hono<{ Bindings: Bindings }>();

const securityScanSchema = z.object({
	tenantData: z.object({
		userCount: z.number().optional().default(0),
		mfaDisabledCount: z.number().optional().default(0),
		inactiveUserCount: z.number().optional().default(0),
		adminCount: z.number().optional().default(0),
		guestCount: z.number().optional().default(0),
		alertCount: z.number().optional().default(0),
	}).optional().default({}),
});

m365Security.post('/api/m365/security-scan', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = securityScanSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}
	const { tenantData } = parsed.data;

	const contextStr = JSON.stringify(tenantData, null, 2);
	const question = `Perform a comprehensive security posture analysis for this M365 tenant.
Return a JSON object with fields:
- riskScore: number (0-100, higher = more risk)
- criticalFindings: string[] (list of critical security issues found)
- recommendations: string[] (actionable security improvements)
- complianceGaps: string[] (compliance issues to address)
- estimatedRemediationHours: number (estimated hours to fix all critical issues)`;

	const bridge = getOpenClawBridge(c.env);

	if (bridge) {
		try {
			const result = await bridge.runAgent('365-security', `${question}\n\nTenant Data:\n${contextStr}`);
			const jsonMatch = result.output.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const analysis = JSON.parse(jsonMatch[0]);
				return c.json({ analysis, source: 'openclaw' });
			}
			return c.json({
				analysis: buildComputedSecurityAnalysis(tenantData),
				source: 'openclaw-raw',
				rawOutput: result.output,
			});
		} catch (_e) {
			// fall through to AI
		}
	}

	const systemPrompt = `You are a Microsoft 365 security expert. Analyze tenant security data and return ONLY valid JSON.`;
	let rawAnswer = '';
	let aiSource = '';

	const best = getBestLLMClient(c.env);
	if (best) {
		rawAnswer = await best.client.complete(`${question}\n\nTenant Data:\n${contextStr}`, systemPrompt);
		aiSource = best.provider;
	} else if (c.env.ANTHROPIC_API_KEY) {
		rawAnswer = await callAnthropic(c.env.ANTHROPIC_API_KEY, systemPrompt, `${question}\n\nTenant Data:\n${contextStr}`);
		aiSource = 'anthropic';
	}

	if (rawAnswer) {
		try {
			const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const analysis = JSON.parse(jsonMatch[0]);
				return c.json({ analysis, source: aiSource });
			}
		} catch (_e) {
			// fall through to computed fallback
		}
	}

	return c.json({ analysis: buildComputedSecurityAnalysis(tenantData), source: 'computed' });
});

function buildComputedSecurityAnalysis(tenantData: Record<string, number>) {
	const mfaRisk = (tenantData.mfaDisabledCount || 0) > 0 ? 30 : 0;
	const inactiveRisk = (tenantData.inactiveUserCount || 0) > 10 ? 20 : 0;
	const adminRisk = (tenantData.adminCount || 0) > 5 ? 15 : 0;
	const riskScore = Math.min(100, 20 + mfaRisk + inactiveRisk + adminRisk);

	return {
		riskScore,
		criticalFindings: [
			tenantData.mfaDisabledCount ? `${tenantData.mfaDisabledCount} users without MFA enabled` : null,
			tenantData.inactiveUserCount > 10 ? `${tenantData.inactiveUserCount} inactive user accounts` : null,
			tenantData.adminCount > 5 ? `High number of admin accounts (${tenantData.adminCount})` : null,
		].filter(Boolean),
		recommendations: [
			'Enable MFA for all users via Conditional Access policy',
			'Review and disable inactive accounts (90+ days)',
			'Apply principle of least privilege to admin roles',
			'Enable Microsoft Defender for Office 365',
			'Configure Identity Protection risk-based Conditional Access',
		],
		complianceGaps: [
			'Missing MFA enforcement policy',
			'Stale account lifecycle management',
			'Privileged identity management not configured',
		],
		estimatedRemediationHours: 8,
	};
}

const licenseOptimizeSchema = z.object({
	licenseData: z.object({
		totalLicenses: z.number().optional().default(0),
		assignedLicenses: z.number().optional().default(0),
		inactiveAssignments: z.number().optional().default(0),
		monthlyCostPerLicense: z.number().optional().default(22),
	}).optional().default({}),
});

m365Security.post('/api/m365/license-optimize', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = licenseOptimizeSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}
	const { licenseData } = parsed.data;

	const contextStr = JSON.stringify(licenseData, null, 2);
	const question = `Analyze M365 license usage and identify cost optimization opportunities.
Return a JSON object with fields:
- wastedLicenses: number (licenses that can be reclaimed)
- estimatedMonthlySavings: number (USD savings per month)
- recommendations: Array<{ action: string; priority: 'high'|'medium'|'low'; estimatedSavings: number }>
- summary: string (brief executive summary)`;

	const bridge = getOpenClawBridge(c.env);

	if (bridge) {
		try {
			const result = await bridge.runAgent('license-optimizer', `${question}\n\nLicense Data:\n${contextStr}`);
			const jsonMatch = result.output.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return c.json({ analysis: JSON.parse(jsonMatch[0]), source: 'openclaw' });
			}
		} catch (_e) {
			// fall through
		}
	}

	const systemPrompt = `You are a Microsoft 365 licensing expert. Analyze license usage and return ONLY valid JSON.`;
	let rawAnswer = '';
	let aiSource = '';
	const best2 = getBestLLMClient(c.env);
	if (best2) {
		rawAnswer = await best2.client.complete(`${question}\n\nLicense Data:\n${contextStr}`, systemPrompt);
		aiSource = best2.provider;
	} else if (c.env.ANTHROPIC_API_KEY) {
		rawAnswer = await callAnthropic(c.env.ANTHROPIC_API_KEY, systemPrompt, `${question}\n\nLicense Data:\n${contextStr}`);
		aiSource = 'anthropic';
	}

	if (rawAnswer) {
		try {
			const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return c.json({ analysis: JSON.parse(jsonMatch[0]), source: aiSource });
			}
		} catch (_e) {
			// fall through
		}
	}

	const inactive = licenseData.inactiveAssignments || 0;
	const costPerLicense = licenseData.monthlyCostPerLicense || 22;
	return c.json({
		analysis: {
			wastedLicenses: inactive,
			estimatedMonthlySavings: inactive * costPerLicense,
			recommendations: [
				{ action: `Remove licenses from ${inactive} inactive users`, priority: 'high', estimatedSavings: inactive * costPerLicense },
				{ action: 'Downgrade E5 to E3 for non-power users', priority: 'medium', estimatedSavings: 0 },
				{ action: 'Review and consolidate duplicate app licenses', priority: 'low', estimatedSavings: 0 },
			],
			summary: `Found ${inactive} wasted license assignments worth $${(inactive * costPerLicense).toFixed(0)}/month in potential savings.`,
		},
		source: 'computed',
	});
});

export { m365Security };
