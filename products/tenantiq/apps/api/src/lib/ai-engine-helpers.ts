/**
 * AI Engine Helpers — shared utilities for AI route handlers.
 */

import { getDb } from './db';
import { eq } from 'drizzle-orm';
import { securityAlerts } from '@tenantiq/db/schema-d1';
import type { Pathway } from './smart-router';

/** Determine which AI pathways are available for this request. */
export function availablePathways(env: {
	ANTHROPIC_API_KEY?: string;
	DEEPSEEK_API_KEY?: string;
	GROQ_API_KEY?: string;
	GEMINI_API_KEY?: string;
	CLAW_API_KEY?: string;
	OPENCLAW_URL?: string;
}): Pathway[] {
	const paths: Pathway[] = ['booster', 'cache'];
	if (env.GROQ_API_KEY) paths.push('groq');
	if (env.GEMINI_API_KEY) paths.push('gemini');
	if (env.DEEPSEEK_API_KEY) paths.push('deepseek');
	if (env.CLAW_API_KEY) paths.push('claw-gateway');
	if (env.ANTHROPIC_API_KEY) paths.push('anthropic');
	if (env.OPENCLAW_URL) paths.push('openclaw');
	return paths;
}

/** Persist critical security findings as alerts in D1. */
export async function persistCriticalFindings(
	env: { DB: D1Database },
	tid: string,
	analysis: { criticalFindings?: string[]; riskScore?: number },
): Promise<void> {
	if (!analysis?.criticalFindings?.length) return;
	const db = getDb(env as any);
	for (const f of analysis.criticalFindings.slice(0, 3)) {
		await db
			.insert(securityAlerts)
			.values({
				id: crypto.randomUUID(),
				tenantId: tid,
				alertType: 'security_risk',
				severity: (analysis.riskScore ?? 0) > 70 ? 'critical' : 'high',
				title: f.slice(0, 200),
				description: `AI finding. Risk: ${analysis.riskScore ?? 0}/100`,
				status: 'active',
				metadata: JSON.stringify({ source: 'ai-engine' }),
				detectedAt: Math.floor(Date.now() / 1000),
			})
			.onConflictDoNothing();
	}
}
