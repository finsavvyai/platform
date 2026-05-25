/**
 * Tenant Health Score & Benchmarking Engine
 *
 * Computes a composite health score (0-100) across 6 dimensions:
 * security, optimization, compliance, adoption, operational, governance.
 * Includes industry benchmarks, trend analysis, and shareable report cards.
 */

// ── Re-exports (preserve public API) ─────────────────────────────────
export type {
	HealthDimension,
	HealthFactor,
	HealthScore,
	ImprovementAction,
	ShareableCard,
	TenantMetrics,
} from './health-score-types';

import type { HealthScore, ImprovementAction, ShareableCard, TenantMetrics } from './health-score-types';
import { computePercentile, scoreToGrade } from './scoring-utils';
import { computeSecurityDimension, computeOptimizationDimension } from './dimensions-security';
import {
	computeComplianceDimension,
	computeAdoptionDimension,
	computeOperationalDimension,
	computeGovernanceDimension,
} from './dimensions-operational';

// ── Main Entry ─────────────────────────────────────────────────────

export function computeHealthScore(metrics: TenantMetrics, tenantName?: string): HealthScore {
	const dimensions = [
		computeSecurityDimension(metrics),
		computeOptimizationDimension(metrics),
		computeComplianceDimension(metrics),
		computeAdoptionDimension(metrics),
		computeOperationalDimension(metrics),
		computeGovernanceDimension(metrics),
	];

	const overall = Math.round(
		dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
	);
	const grade = scoreToGrade(overall);
	const percentile = computePercentile(overall);

	const allFactors = dimensions.flatMap((d) => d.factors);

	const topWins = allFactors
		.filter((f) => f.status === 'excellent')
		.slice(0, 3)
		.map((f) => `✅ ${f.label}: ${f.score}/${f.maxScore}`);

	const topRisks = allFactors
		.filter((f) => f.status === 'critical' || f.status === 'needs_attention')
		.sort((a, b) => a.score - b.score)
		.slice(0, 3)
		.map((f) => `⚠️ ${f.label}: ${f.score}/${f.maxScore}${f.recommendation ? ` — ${f.recommendation}` : ''}`);

	const improvementPlan: ImprovementAction[] = allFactors
		.filter((f) => f.recommendation && f.status !== 'excellent')
		.sort((a, b) => a.score - b.score)
		.slice(0, 5)
		.map((f, i) => ({
			id: `imp-${i + 1}`,
			title: f.recommendation!,
			impact: f.score < 40 ? 'high' as const : f.score < 70 ? 'medium' as const : 'low' as const,
			effort: f.score < 30 ? 'low' as const : 'medium' as const,
			estimatedScoreGain: Math.round((f.maxScore - f.score) * 0.3),
			category: f.id.split('_')[0],
			description: `Improving ${f.label} from ${f.score} to ${f.maxScore} would increase overall health score`,
		}));

	const shareableCard = buildShareableCard(tenantName, overall, grade, percentile, dimensions);

	return {
		overall,
		grade,
		percentile,
		dimensions,
		topWins,
		topRisks,
		improvementPlan,
		shareableCard,
		generatedAt: new Date().toISOString(),
	};
}

function buildShareableCard(
	tenantName: string | undefined,
	overall: number,
	grade: string,
	percentile: number,
	dimensions: { name: string; score: number }[],
): ShareableCard {
	const dimEmojis: Record<string, string> = {
		Security: '🛡️',
		'Cost Optimization': '💰',
		Compliance: '📋',
		Adoption: '👥',
		Operational: '⚙️',
		Governance: '🏛️',
	};

	return {
		title: `${tenantName || 'Tenant'} Health Report`,
		subtitle: `Score: ${overall}/100 (${grade}) — Top ${100 - percentile}% of M365 tenants`,
		score: overall,
		grade,
		dimensions: dimensions.map((d) => ({
			name: d.name,
			score: d.score,
			emoji: dimEmojis[d.name] || '📊',
		})),
		callToAction: 'Powered by TenantIQ — AI-powered M365 intelligence',
		shareUrl: `https://app.tenantiq.app/health-report`,
	};
}

export function generateHealthScorePrompt(score: HealthScore): string {
	const dimSummary = score.dimensions
		.map((d) => `- ${d.name}: ${d.score}/100 (${d.grade})`)
		.join('\n');

	return `
## Tenant Health Score Report

**Overall Score: ${score.overall}/100 (${score.grade})**
Percentile: Top ${100 - score.percentile}% of M365 tenants

### Dimensions
${dimSummary}

### Top Wins
${score.topWins.join('\n')}

### Top Risks
${score.topRisks.join('\n')}

### Improvement Plan
${score.improvementPlan.map((a) => `- [${a.impact.toUpperCase()} impact] ${a.title} (+${a.estimatedScoreGain} pts)`).join('\n')}

Provide an executive summary with:
1. Key strengths to maintain
2. Critical areas needing immediate attention
3. A 30-day improvement roadmap
4. Estimated score after improvements
5. Comparison to industry best practices
`;
}
