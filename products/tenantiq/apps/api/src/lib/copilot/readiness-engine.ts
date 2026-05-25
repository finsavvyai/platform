/**
 * Copilot Readiness Engine — orchestrates all 7 category checks
 * and computes an overall readiness score.
 */

import type { Check, CategoryKey, CategoryResult, ReadinessResult, Recommendation } from './readiness-types';
import {
	checkLicensing,
	checkIdentityAccess,
	checkDataProtection,
	checkCompliance,
	checkSecurity,
	checkCollaboration,
	checkDataQuality,
} from './readiness-checks';

type GraphFetch = (path: string) => Promise<Record<string, unknown>>;

/** Weight each category for overall score calculation. */
const WEIGHTS: Record<CategoryKey, number> = {
	licensing: 20,
	identityAccess: 18,
	dataProtection: 18,
	compliance: 12,
	security: 12,
	collaboration: 12,
	dataQuality: 8,
};

function scoreChecks(checks: Check[]): number {
	const scorable = checks.filter((c) => c.status !== 'error');
	if (scorable.length === 0) return 0;
	const pts = scorable.reduce(
		(s, c) => s + (c.status === 'pass' ? 100 : c.status === 'warning' ? 50 : 0),
		0,
	);
	return Math.round(pts / scorable.length);
}

function computeOverall(categories: Record<CategoryKey, CategoryResult>): number {
	let totalWeight = 0;
	let weighted = 0;
	for (const [key, result] of Object.entries(categories)) {
		const w = WEIGHTS[key as CategoryKey] || 10;
		weighted += result.score * w;
		totalWeight += w;
	}
	return totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
}

export async function assessCopilotReadiness(graphFetch: GraphFetch): Promise<ReadinessResult> {
	const allRecs: Recommendation[] = [];

	const [licensing, identity, dataProt, compliance, security, collab, quality] =
		await Promise.all([
			checkLicensing(graphFetch),
			checkIdentityAccess(graphFetch),
			checkDataProtection(graphFetch),
			checkCompliance(graphFetch),
			checkSecurity(graphFetch),
			checkCollaboration(graphFetch),
			checkDataQuality(graphFetch),
		]);

	const results = [licensing, identity, dataProt, compliance, security, collab, quality];
	results.forEach((r) => allRecs.push(...r.recs));

	const categories: Record<CategoryKey, CategoryResult> = {
		licensing: { score: scoreChecks(licensing.checks), checks: licensing.checks },
		identityAccess: { score: scoreChecks(identity.checks), checks: identity.checks },
		dataProtection: { score: scoreChecks(dataProt.checks), checks: dataProt.checks },
		compliance: { score: scoreChecks(compliance.checks), checks: compliance.checks },
		security: { score: scoreChecks(security.checks), checks: security.checks },
		collaboration: { score: scoreChecks(collab.checks), checks: collab.checks },
		dataQuality: { score: scoreChecks(quality.checks), checks: quality.checks },
	};

	const overallScore = computeOverall(categories);

	// Sort recommendations by priority
	const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
	allRecs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

	if (allRecs.length === 0) {
		allRecs.push({
			category: 'licensing',
			priority: 'low',
			title: 'Ready for deployment',
			description: 'Your tenant looks ready for Microsoft 365 Copilot',
		});
	}

	return {
		overallScore,
		categories,
		recommendations: allRecs,
		assessedAt: new Date().toISOString(),
	};
}
