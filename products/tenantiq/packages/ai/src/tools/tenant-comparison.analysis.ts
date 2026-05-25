/**
 * Tenant Comparison — Analysis Helpers
 *
 * Rankings, standardization gaps, best practices, and risk assessment.
 */

import type {
	TenantSnapshot,
	TenantRanking,
	StandardizationGap,
	BestPractice,
	RiskMatrixEntry,
} from './tenant-comparison.types';

// ── Rankings ──────────────────────────────────────────────────────

export function computeRankings(tenants: TenantSnapshot[]): TenantRanking[] {
	const rank = (key: keyof TenantSnapshot, label: string, icon: string, format: (v: number) => string, higher = true) => {
		const sorted = [...tenants].sort((a, b) => higher
			? (b[key] as number) - (a[key] as number)
			: (a[key] as number) - (b[key] as number));
		return {
			category: label,
			icon,
			rankings: sorted.map((t, i) => ({
				rank: i + 1,
				tenantName: t.tenantName,
				value: format(t[key] as number),
				score: t[key] as number,
			})),
		};
	};

	return [
		rank('healthScore', 'Health Score', '❤️', (v) => `${v}/100`),
		rank('secureScore', 'Secure Score', '🛡️', (v) => `${v}/100`),
		rank('mfaAdoption', 'MFA Adoption', '🔑', (v) => `${v}%`),
		rank('licenseUtilization', 'License Utilization', '📊', (v) => `${v}%`),
		rank('costPerUser', 'Cost Per User', '💰', (v) => `$${v}/mo`, false),
		rank('wastedSpend', 'Lowest Waste', '♻️', (v) => `$${v}/mo`, false),
	];
}

// ── Standardization Gaps ──────────────────────────────────────────

export function detectStandardizationGaps(tenants: TenantSnapshot[]): StandardizationGap[] {
	if (tenants.length < 2) return [];
	const gaps: StandardizationGap[] = [];

	const metrics: { key: keyof TenantSnapshot; label: string; threshold: number; unit: string }[] = [
		{ key: 'mfaAdoption', label: 'MFA Adoption', threshold: 20, unit: '%' },
		{ key: 'secureScore', label: 'Secure Score', threshold: 25, unit: 'pts' },
		{ key: 'licenseUtilization', label: 'License Utilization', threshold: 20, unit: '%' },
		{ key: 'costPerUser', label: 'Cost Per User', threshold: 15, unit: '$/mo' },
		{ key: 'complianceScore', label: 'Compliance Score', threshold: 25, unit: 'pts' },
	];

	for (const m of metrics) {
		const values = tenants.map((t) => t[m.key] as number);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const spread = max - min;

		if (spread > m.threshold) {
			const lowTenants = tenants
				.filter((t) => (t[m.key] as number) < min + spread * 0.3)
				.map((t) => t.tenantName);

			gaps.push({
				area: m.label,
				metric: m.key,
				min,
				max,
				spread,
				recommendation: `Standardize ${m.label} across tenants — spread of ${spread}${m.unit} detected. Bring lagging tenants up to portfolio average.`,
				affectedTenants: lowTenants,
			});
		}
	}

	return gaps.sort((a, b) => b.spread - a.spread);
}

// ── Best Practices ────────────────────────────────────────────────

export function identifyBestPractices(tenants: TenantSnapshot[]): BestPractice[] {
	if (tenants.length < 2) return [];
	const practices: BestPractice[] = [];

	const best = {
		mfa: [...tenants].sort((a, b) => b.mfaAdoption - a.mfaAdoption)[0],
		secure: [...tenants].sort((a, b) => b.secureScore - a.secureScore)[0],
		cost: [...tenants].sort((a, b) => a.costPerUser - b.costPerUser)[0],
		utilization: [...tenants].sort((a, b) => b.licenseUtilization - a.licenseUtilization)[0],
	};

	const avg = {
		mfa: tenants.reduce((s, t) => s + t.mfaAdoption, 0) / tenants.length,
		secure: tenants.reduce((s, t) => s + t.secureScore, 0) / tenants.length,
	};

	if (best.mfa.mfaAdoption > avg.mfa + 10) {
		practices.push({
			id: 'bp_mfa',
			title: `MFA best practice from ${best.mfa.tenantName}`,
			sourceTenant: best.mfa.tenantName,
			metric: 'MFA Adoption',
			value: `${best.mfa.mfaAdoption}%`,
			applicableTenants: tenants.filter((t) => t.mfaAdoption < avg.mfa).map((t) => t.tenantName),
			estimatedImpact: `Improve portfolio MFA average from ${Math.round(avg.mfa)}% to ${best.mfa.mfaAdoption}%`,
		});
	}

	if (best.cost.costPerUser < tenants.reduce((s, t) => s + t.costPerUser, 0) / tenants.length * 0.8) {
		const expensiveTenants = tenants.filter((t) => t.costPerUser > best.cost.costPerUser * 1.3);
		practices.push({
			id: 'bp_cost',
			title: `Cost optimization from ${best.cost.tenantName}`,
			sourceTenant: best.cost.tenantName,
			metric: 'Cost Per User',
			value: `$${best.cost.costPerUser}/mo`,
			applicableTenants: expensiveTenants.map((t) => t.tenantName),
			estimatedImpact: `Potential savings of $${Math.round(expensiveTenants.reduce((s, t) => s + (t.costPerUser - best.cost.costPerUser) * t.userCount, 0))}/mo`,
		});
	}

	return practices;
}

// ── Risk Matrix ───────────────────────────────────────────────────

export function assessRiskMatrix(tenants: TenantSnapshot[]): RiskMatrixEntry[] {
	return tenants.map((t) => {
		const factors: string[] = [];
		let riskScore = 0;

		if (t.mfaAdoption < 70) { factors.push(`Low MFA (${t.mfaAdoption}%)`); riskScore += 25; }
		if (t.secureScore < 50) { factors.push(`Low Secure Score (${t.secureScore})`); riskScore += 25; }
		if (t.criticalAlerts > 0) { factors.push(`${t.criticalAlerts} critical alerts`); riskScore += 20; }
		if (t.wastedSpend > t.monthlySpend * 0.2) { factors.push(`High waste (${Math.round(t.wastedSpend / t.monthlySpend * 100)}%)`); riskScore += 15; }
		if (t.licenseUtilization < 60) { factors.push(`Low utilization (${t.licenseUtilization}%)`); riskScore += 15; }

		const riskLevel: RiskMatrixEntry['riskLevel'] =
			riskScore >= 60 ? 'critical' : riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

		return { tenantName: t.tenantName, riskLevel, riskScore: Math.min(100, riskScore), factors };
	}).sort((a, b) => b.riskScore - a.riskScore);
}
