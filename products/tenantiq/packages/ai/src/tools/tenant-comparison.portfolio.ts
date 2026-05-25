/**
 * Tenant Comparison — Portfolio Helpers
 *
 * Portfolio summary computation, recommendations, and formatting.
 */

import type {
	TenantSnapshot,
	PortfolioSummary,
	PortfolioRecommendation,
	StandardizationGap,
	RiskMatrixEntry,
} from './tenant-comparison.types';

// ── Grading ───────────────────────────────────────────────────────

export function gradeFromScore(score: number): string {
	if (score >= 95) return 'A+';
	if (score >= 85) return 'A';
	if (score >= 75) return 'B';
	if (score >= 60) return 'C';
	if (score >= 40) return 'D';
	return 'F';
}

// ── Portfolio Summary ─────────────────────────────────────────────

export function computePortfolioSummary(tenants: TenantSnapshot[]): PortfolioSummary {
	const n = tenants.length || 1;
	const totalUsers = tenants.reduce((s, t) => s + t.userCount, 0);
	const totalSpend = tenants.reduce((s, t) => s + t.monthlySpend, 0);
	const totalWaste = tenants.reduce((s, t) => s + t.wastedSpend, 0);
	const totalAlerts = tenants.reduce((s, t) => s + t.activeAlerts, 0);
	const totalCritical = tenants.reduce((s, t) => s + t.criticalAlerts, 0);

	const sorted = [...tenants].sort((a, b) => b.healthScore - a.healthScore);

	return {
		totalTenants: tenants.length,
		totalUsers,
		totalMonthlySpend: totalSpend,
		totalWaste: totalWaste,
		avgHealthScore: Math.round(tenants.reduce((s, t) => s + t.healthScore, 0) / n),
		avgSecureScore: Math.round(tenants.reduce((s, t) => s + t.secureScore, 0) / n),
		avgMfaAdoption: Math.round(tenants.reduce((s, t) => s + t.mfaAdoption, 0) / n),
		avgLicenseUtilization: Math.round(tenants.reduce((s, t) => s + t.licenseUtilization, 0) / n),
		totalAlerts,
		totalCriticalAlerts: totalCritical,
		bestTenant: sorted[0]?.tenantName ?? 'N/A',
		worstTenant: sorted[sorted.length - 1]?.tenantName ?? 'N/A',
	};
}

// ── Recommendations ───────────────────────────────────────────────

export function buildPortfolioRecommendations(
	tenants: TenantSnapshot[],
	gaps: StandardizationGap[],
	_risks: RiskMatrixEntry[]
): PortfolioRecommendation[] {
	const recs: PortfolioRecommendation[] = [];

	// Cost savings
	const highWaste = tenants.filter((t) => t.wastedSpend > 200);
	if (highWaste.length > 0) {
		const totalSavings = highWaste.reduce((s, t) => s + t.wastedSpend, 0);
		recs.push({
			priority: 1,
			title: 'Portfolio-wide license reclamation',
			description: `${highWaste.length} tenants have significant license waste totaling $${totalSavings}/mo`,
			affectedTenants: highWaste.map((t) => t.tenantName),
			estimatedSavings: totalSavings * 12,
			category: 'cost',
		});
	}

	// Security standardization
	const lowMfa = tenants.filter((t) => t.mfaAdoption < 90);
	if (lowMfa.length > 0) {
		recs.push({
			priority: 2,
			title: 'Enforce MFA across all tenants',
			description: `${lowMfa.length} tenants below 90% MFA adoption`,
			affectedTenants: lowMfa.map((t) => t.tenantName),
			category: 'security',
		});
	}

	// Critical alerts
	const critTenants = tenants.filter((t) => t.criticalAlerts > 0);
	if (critTenants.length > 0) {
		recs.push({
			priority: 3,
			title: 'Resolve critical alerts',
			description: `${critTenants.reduce((s, t) => s + t.criticalAlerts, 0)} critical alerts across ${critTenants.length} tenants`,
			affectedTenants: critTenants.map((t) => t.tenantName),
			category: 'security',
		});
	}

	// Standardization
	for (const gap of gaps.slice(0, 2)) {
		recs.push({
			priority: recs.length + 1,
			title: `Standardize ${gap.area}`,
			description: gap.recommendation,
			affectedTenants: gap.affectedTenants,
			category: 'operational',
		});
	}

	return recs;
}
