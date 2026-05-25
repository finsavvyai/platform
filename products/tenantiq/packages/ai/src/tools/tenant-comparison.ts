/**
 * Tenant Comparison — MSP Multi-Tenant Insights
 *
 * Cross-tenant benchmarking for MSPs managing multiple M365 tenants:
 * - Side-by-side tenant comparison
 * - Standardization scoring
 * - Best practice propagation
 * - Portfolio-wide risk assessment
 * - Client reporting
 */

export type {
	TenantSnapshot,
	ComparisonResult,
	PortfolioSummary,
	TenantRanking,
	StandardizationGap,
	BestPractice,
	RiskMatrixEntry,
	PortfolioRecommendation,
	ShareablePortfolioReport,
} from './tenant-comparison.types';

export { computeRankings, detectStandardizationGaps, identifyBestPractices, assessRiskMatrix } from './tenant-comparison.analysis';
export { gradeFromScore, computePortfolioSummary, buildPortfolioRecommendations } from './tenant-comparison.portfolio';

import type { TenantSnapshot, ComparisonResult, ShareablePortfolioReport } from './tenant-comparison.types';
import { computeRankings, detectStandardizationGaps, identifyBestPractices, assessRiskMatrix } from './tenant-comparison.analysis';
import { gradeFromScore, computePortfolioSummary, buildPortfolioRecommendations } from './tenant-comparison.portfolio';

// ── Main Entry ─────────────────────────────────────────────────────

export function compareTenants(tenants: TenantSnapshot[]): ComparisonResult {
	const portfolioSummary = computePortfolioSummary(tenants);
	const rankings = computeRankings(tenants);
	const gaps = detectStandardizationGaps(tenants);
	const bestPractices = identifyBestPractices(tenants);
	const riskMatrix = assessRiskMatrix(tenants);
	const recommendations = buildPortfolioRecommendations(tenants, gaps, riskMatrix);

	const allScores = tenants.map((t) => t.healthScore);
	const stdDev = tenants.length > 1
		? Math.sqrt(allScores.reduce((s, v) => s + Math.pow(v - portfolioSummary.avgHealthScore, 2), 0) / tenants.length)
		: 0;
	const standardizationScore = Math.max(0, Math.round(100 - stdDev * 2 - gaps.length * 5));

	const shareableReport: ShareablePortfolioReport = {
		title: `MSP Portfolio Report — ${tenants.length} Tenants`,
		summary: `Managing ${portfolioSummary.totalUsers} users across ${tenants.length} tenants. Average health: ${gradeFromScore(portfolioSummary.avgHealthScore)}.`,
		totalTenants: tenants.length,
		totalUsers: portfolioSummary.totalUsers,
		totalSavingsOpportunity: `$${(portfolioSummary.totalWaste * 12).toLocaleString()}/yr`,
		avgHealthGrade: gradeFromScore(portfolioSummary.avgHealthScore),
		topRecommendation: recommendations[0]?.title ?? 'No urgent recommendations',
	};

	return {
		generatedAt: new Date().toISOString(),
		tenants,
		portfolioSummary,
		rankings,
		standardizationScore,
		standardizationGaps: gaps,
		bestPractices,
		riskMatrix,
		recommendations,
		shareableReport,
	};
}
