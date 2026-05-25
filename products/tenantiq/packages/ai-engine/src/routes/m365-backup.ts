/**
 * TenantIQ AI Engine — M365 Backup Analysis Route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { callAnthropic, getBestLLMClient } from '../lib/llm';
import { getOpenClawBridge } from '../helpers';
import type { Bindings } from '../types';

const m365Backup = new Hono<{ Bindings: Bindings }>();

const backupAnalyzeSchema = z.object({
	backupData: z.object({
		totalItems: z.number().optional().default(0),
		lastBackupTimestamp: z.string().optional(),
		failedBackups: z.number().optional().default(0),
		backupSizeGB: z.number().optional().default(0),
		retentionDays: z.number().optional().default(30),
		encryptionEnabled: z.boolean().optional().default(false),
		exchangeBackupEnabled: z.boolean().optional().default(false),
		sharepointBackupEnabled: z.boolean().optional().default(false),
		onedriveBackupEnabled: z.boolean().optional().default(false),
	}).optional().default({}),
});

m365Backup.post('/api/m365/backup-analyze', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = backupAnalyzeSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}
	const { backupData } = parsed.data;

	const contextStr = JSON.stringify(backupData, null, 2);
	const question = `Analyze M365 backup health and identify risks.
Return a JSON object with fields:
- healthScore: number (0-100, higher = healthier backup posture)
- criticalIssues: string[] (critical backup problems that need immediate attention)
- recommendations: Array<{ action: string; priority: 'critical'|'high'|'medium'|'low'; impact: string }>
- estimatedDataAtRisk: string (estimated data volume at risk without proper backups)
- complianceStatus: { gdpr: boolean; hipaa: boolean; soc2: boolean } (backup compliance check)`;

	const bridge = getOpenClawBridge(c.env);

	if (bridge) {
		try {
			const result = await bridge.runAgent('backup-monitor', `${question}\n\nBackup Data:\n${contextStr}`);
			const jsonMatch = result.output.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return c.json({ analysis: JSON.parse(jsonMatch[0]), source: 'openclaw' });
			}
		} catch (_e) {
			// fall through
		}
	}

	const systemPrompt = `You are a Microsoft 365 backup and disaster recovery expert. Analyze backup data and return ONLY valid JSON.`;
	let rawAnswer = '';
	let aiSource = '';

	const best = getBestLLMClient(c.env);
	if (best) {
		rawAnswer = await best.client.complete(`${question}\n\nBackup Data:\n${contextStr}`, systemPrompt);
		aiSource = best.provider;
	} else if (c.env.ANTHROPIC_API_KEY) {
		rawAnswer = await callAnthropic(c.env.ANTHROPIC_API_KEY, systemPrompt, `${question}\n\nBackup Data:\n${contextStr}`);
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
		analysis: buildComputedBackupAnalysis(backupData),
		source: 'computed',
	});
});

function buildComputedBackupAnalysis(backupData: {
	lastBackupTimestamp?: string;
	failedBackups: number;
	encryptionEnabled: boolean;
	exchangeBackupEnabled: boolean;
	sharepointBackupEnabled: boolean;
	backupSizeGB: number;
	retentionDays: number;
}) {
	const lastBackupAge = backupData.lastBackupTimestamp
		? Math.floor((Date.now() - new Date(backupData.lastBackupTimestamp).getTime()) / (1000 * 60 * 60 * 24))
		: 999;
	const healthScore = Math.max(
		0,
		100 - (lastBackupAge > 7 ? 40 : 0) - (backupData.failedBackups || 0) * 10 - (!backupData.encryptionEnabled ? 20 : 0),
	);

	return {
		healthScore,
		criticalIssues: [
			lastBackupAge > 7 ? `Last successful backup was ${lastBackupAge} days ago (exceeds 7-day best practice)` : null,
			backupData.failedBackups ? `${backupData.failedBackups} failed backup attempts detected` : null,
			!backupData.encryptionEnabled ? 'Backup encryption is not enabled (compliance risk)' : null,
			!backupData.exchangeBackupEnabled ? 'Exchange Online mailboxes are not being backed up' : null,
			!backupData.sharepointBackupEnabled ? 'SharePoint sites are not being backed up' : null,
		].filter(Boolean),
		recommendations: [
			{ action: 'Enable automated daily backups for all M365 workloads', priority: 'critical' as const, impact: 'Protects against data loss and ransomware' },
			{ action: 'Implement immutable backups with 30-day retention minimum', priority: 'high' as const, impact: 'Prevents backup tampering and ensures compliance' },
			{ action: 'Enable backup encryption at rest and in transit', priority: 'high' as const, impact: 'Meets GDPR and HIPAA requirements' },
			{ action: 'Configure backup monitoring alerts for failed jobs', priority: 'medium' as const, impact: 'Early detection of backup failures' },
			{ action: 'Test disaster recovery procedures quarterly', priority: 'medium' as const, impact: 'Validates restore capabilities' },
		],
		estimatedDataAtRisk: `${backupData.backupSizeGB || 500}GB of M365 data`,
		complianceStatus: {
			gdpr: backupData.encryptionEnabled && backupData.retentionDays >= 30,
			hipaa: backupData.encryptionEnabled && backupData.retentionDays >= 180,
			soc2: backupData.encryptionEnabled && lastBackupAge <= 7,
		},
	};
}

export { m365Backup };
