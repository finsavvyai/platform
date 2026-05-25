/**
 * TenantIQ AI Engine — M365 Phishing Scan Route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { callAnthropic, getBestLLMClient } from '../lib/llm';
import { getOpenClawBridge } from '../helpers';
import type { Bindings } from '../types';

const m365Phishing = new Hono<{ Bindings: Bindings }>();

const phishingScanSchema = z.object({
	emailData: z.object({
		totalEmails: z.number().optional().default(0),
		quarantinedEmails: z.number().optional().default(0),
		suspiciousLinks: z.number().optional().default(0),
		spoofedSenders: z.number().optional().default(0),
		malwareDetected: z.number().optional().default(0),
		userReportedPhishing: z.number().optional().default(0),
		antiPhishingEnabled: z.boolean().optional().default(false),
		safeLinksEnabled: z.boolean().optional().default(false),
		safeAttachmentsEnabled: z.boolean().optional().default(false),
		dkimEnabled: z.boolean().optional().default(false),
		dmarcEnabled: z.boolean().optional().default(false),
	}).optional().default({}),
	timeRangeHours: z.number().optional().default(24),
});

m365Phishing.post('/api/m365/phishing-scan', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = phishingScanSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}
	const { emailData, timeRangeHours } = parsed.data;

	const contextStr = JSON.stringify({ ...emailData, timeRangeHours }, null, 2);
	const question = `Analyze M365 email phishing threats and security posture.
Return a JSON object with fields:
- threatLevel: 'critical' | 'high' | 'medium' | 'low' (overall phishing threat level)
- phishingScore: number (0-100, higher = more phishing activity detected)
- activeThreats: Array<{ type: string; count: number; severity: 'critical'|'high'|'medium'; description: string }>
- recommendations: Array<{ action: string; priority: 'critical'|'high'|'medium'|'low'; benefit: string }>
- protectionGaps: string[] (missing or misconfigured email security controls)
- estimatedRisk: string (business impact assessment)`;

	const bridge = getOpenClawBridge(c.env);

	if (bridge) {
		try {
			const result = await bridge.runAgent('phishing-detector', `${question}\n\nEmail Data:\n${contextStr}`);
			const jsonMatch = result.output.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return c.json({ analysis: JSON.parse(jsonMatch[0]), source: 'openclaw' });
			}
		} catch (_e) {
			// fall through
		}
	}

	const systemPrompt = `You are a Microsoft 365 email security and anti-phishing expert. Analyze email threat data and return ONLY valid JSON.`;
	let rawAnswer = '';
	let aiSource = '';

	const best = getBestLLMClient(c.env);
	if (best) {
		rawAnswer = await best.client.complete(`${question}\n\nEmail Data:\n${contextStr}`, systemPrompt);
		aiSource = best.provider;
	} else if (c.env.ANTHROPIC_API_KEY) {
		rawAnswer = await callAnthropic(c.env.ANTHROPIC_API_KEY, systemPrompt, `${question}\n\nEmail Data:\n${contextStr}`);
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

	return c.json({
		analysis: buildComputedPhishingAnalysis(emailData, timeRangeHours),
		source: 'computed',
	});
});

function buildComputedPhishingAnalysis(
	emailData: {
		totalEmails: number;
		quarantinedEmails: number;
		suspiciousLinks: number;
		spoofedSenders: number;
		malwareDetected: number;
		userReportedPhishing: number;
		antiPhishingEnabled: boolean;
		safeLinksEnabled: boolean;
		safeAttachmentsEnabled: boolean;
		dkimEnabled: boolean;
		dmarcEnabled: boolean;
	},
	timeRangeHours: number,
) {
	const phishingRate = emailData.totalEmails > 0
		? ((emailData.quarantinedEmails || 0) + (emailData.userReportedPhishing || 0)) / emailData.totalEmails * 100
		: 0;
	const phishingScore = Math.min(100, phishingRate * 10 + (emailData.malwareDetected || 0) * 5);
	const threatLevel = phishingScore > 75 ? 'critical' : phishingScore > 50 ? 'high' : phishingScore > 25 ? 'medium' : 'low';

	return {
		threatLevel,
		phishingScore: Math.round(phishingScore),
		activeThreats: [
			emailData.quarantinedEmails ? {
				type: 'Quarantined Phishing Emails',
				count: emailData.quarantinedEmails,
				severity: 'high' as const,
				description: `${emailData.quarantinedEmails} suspicious emails quarantined in the last ${timeRangeHours} hours`,
			} : null,
			emailData.spoofedSenders ? {
				type: 'Sender Spoofing Attempts',
				count: emailData.spoofedSenders,
				severity: 'high' as const,
				description: `${emailData.spoofedSenders} emails detected with spoofed sender addresses`,
			} : null,
			emailData.malwareDetected ? {
				type: 'Malware Attachments',
				count: emailData.malwareDetected,
				severity: 'critical' as const,
				description: `${emailData.malwareDetected} emails contained malicious attachments`,
			} : null,
			emailData.suspiciousLinks ? {
				type: 'Suspicious Links',
				count: emailData.suspiciousLinks,
				severity: 'medium' as const,
				description: `${emailData.suspiciousLinks} emails contained potentially malicious URLs`,
			} : null,
		].filter(Boolean),
		recommendations: [
			!emailData.antiPhishingEnabled ? { action: 'Enable Microsoft Defender anti-phishing policies', priority: 'critical' as const, benefit: 'Blocks known phishing patterns and spoofing attempts' } : null,
			!emailData.safeLinksEnabled ? { action: 'Enable Safe Links for time-of-click URL protection', priority: 'critical' as const, benefit: 'Protects users from malicious links even after email delivery' } : null,
			!emailData.safeAttachmentsEnabled ? { action: 'Enable Safe Attachments for zero-day malware protection', priority: 'critical' as const, benefit: 'Detonates attachments in sandbox before delivery' } : null,
			!emailData.dmarcEnabled ? { action: 'Configure DMARC policy with enforcement (p=quarantine or p=reject)', priority: 'high' as const, benefit: 'Prevents domain spoofing and email impersonation attacks' } : null,
			!emailData.dkimEnabled ? { action: 'Enable DKIM signing for outbound emails', priority: 'high' as const, benefit: 'Authenticates your domain and improves email deliverability' } : null,
			{ action: 'Deploy user phishing simulation training quarterly', priority: 'medium' as const, benefit: 'Reduces human click-through rate on phishing emails by 70%' },
			{ action: 'Configure mailbox intelligence and impersonation protection', priority: 'medium' as const, benefit: 'Detects unusual sender patterns and executive impersonation' },
		].filter(Boolean),
		protectionGaps: [
			!emailData.antiPhishingEnabled ? 'Anti-phishing policies not configured' : null,
			!emailData.safeLinksEnabled ? 'Safe Links (URL protection) disabled' : null,
			!emailData.safeAttachmentsEnabled ? 'Safe Attachments (sandbox) disabled' : null,
			!emailData.dmarcEnabled ? 'DMARC not enforced (domain spoofing risk)' : null,
			!emailData.dkimEnabled ? 'DKIM signing not enabled' : null,
		].filter(Boolean),
		estimatedRisk: phishingScore > 50
			? 'High risk of credential theft and business email compromise. Immediate action required.'
			: 'Moderate risk. Strengthen email security controls to reduce attack surface.',
	};
}

export { m365Phishing };
