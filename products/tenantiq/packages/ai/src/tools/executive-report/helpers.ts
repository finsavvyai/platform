/**
 * Executive Report Helpers
 *
 * Utility functions: ID generation, formatting, executive summary, benchmark/share text.
 */

import type { ReportConfig, ReportMetrics, ReportSection } from './types';

// ── ID & Token Generators ─────────────────────────────────────────

export function generateReportId(): string {
	return `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateShareToken(): string {
	return `share_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

// ── Formatters ────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
	return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPct(value: number): string {
	return `${value.toFixed(1)}%`;
}

// ── Executive Summary ─────────────────────────────────────────────

export function buildExecutiveSummary(
	config: ReportConfig,
	m: ReportMetrics,
	sections: ReportSection[],
): string {
	const periodLabel =
		config.reportPeriod === 'weekly'
			? 'This Week'
			: config.reportPeriod === 'monthly'
				? 'This Month'
				: 'This Quarter';

	const highlights = sections.flatMap((s) => s.highlights).filter(Boolean).slice(0, 3);
	const risks = sections.flatMap((s) => s.risks).filter(Boolean).slice(0, 3);

	return `## ${periodLabel} at a Glance — ${config.tenantName}

**${m.totalUsers} users** across your M365 tenant. **${m.activeUsers}** active this period.

### Highlights
${highlights.map((h) => `- ✅ ${h}`).join('\n') || '- No major highlights this period'}

### Attention Required
${risks.map((r) => `- ⚠️ ${r}`).join('\n') || '- No critical items — great job!'}

### Key Numbers
- **Monthly Spend**: ${formatCurrency(m.monthlyLicenseCost)} | **Waste**: ${formatCurrency(m.wastedLicenseCost)}/mo
- **Secure Score**: ${m.secureScore}/100 | **MFA**: ${formatPct(m.mfaAdoptionRate)}
- **Alerts**: ${m.alertsResolved}/${m.alertsGenerated} resolved | **Remediations**: ${m.remediationsExecuted}
`;
}

// ── Benchmark & Share ─────────────────────────────────────────────

export function buildBenchmarkSummary(
	config: ReportConfig,
	metrics: ReportMetrics,
	overallScore: number,
): string {
	if (!metrics.healthScore) {
		return `${config.tenantName} closed the period with an estimated health score of ${overallScore}/100. Security posture and operational follow-through remain the biggest confidence drivers for leadership.`;
	}

	const bestDimension = [...metrics.healthScore.dimensions].sort((a, b) => b.score - a.score)[0];
	const weakestDimension = [...metrics.healthScore.dimensions].sort((a, b) => a.score - b.score)[0];
	const topBand = Math.max(1, 100 - metrics.healthScore.percentile);

	return `${config.tenantName} ranks in the top ${topBand}% of modeled M365 tenants with a health score of ${metrics.healthScore.overall}/100. Strongest area: ${bestDimension.name} (${bestDimension.score}/100). Biggest upside: ${weakestDimension.name} (${weakestDimension.score}/100).`;
}

export function buildShareSnippet(
	config: ReportConfig,
	metrics: ReportMetrics,
	overallScore: number,
): string {
	if (!metrics.healthScore) {
		return `${config.tenantName} finished the ${config.reportPeriod} with an estimated health score of ${overallScore}/100, ${metrics.remediationsExecuted} remediations executed, and ${metrics.alertsResolved} alerts resolved.`;
	}

	const bestDimension = [...metrics.healthScore.dimensions].sort((a, b) => b.score - a.score)[0];
	const topBand = Math.max(1, 100 - metrics.healthScore.percentile);

	return `${config.tenantName} finished the ${config.reportPeriod} at ${metrics.healthScore.overall}/100 (${metrics.healthScore.grade}), ranking in the top ${topBand}% of modeled M365 tenants. Strongest dimension: ${bestDimension.name} (${bestDimension.score}/100).`;
}
