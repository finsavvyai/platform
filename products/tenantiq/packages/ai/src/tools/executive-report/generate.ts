/**
 * Executive Report Generator — Main Entry
 *
 * Orchestrates section builders, helpers, and HTML email to produce
 * the final ExecutiveReport object.
 */

import type { ReportConfig, ReportMetrics, ReportSection, ExecutiveReport } from './types';
import { generateReportId, generateShareToken, buildExecutiveSummary, buildBenchmarkSummary, buildShareSnippet } from './helpers';
import {
	buildSecuritySection,
	buildFinancialSection,
	buildOperationsSection,
} from './section-builders';
import { buildKeyActions, buildFinancialSummary, buildComplianceSection } from './actions';
import { buildHtmlEmail } from './html-email';

export function generateExecutiveReport(config: ReportConfig, metrics: ReportMetrics): ExecutiveReport {
	const sections: ReportSection[] = [];

	if (config.includeSecurity) sections.push(buildSecuritySection(metrics));
	if (config.includeFinancials) sections.push(buildFinancialSection(metrics));
	sections.push(buildOperationsSection(metrics));
	if (config.includeCompliance) sections.push(buildComplianceSection(metrics));

	const executiveSummary = buildExecutiveSummary(config, metrics, sections);
	const keyActions = buildKeyActions(metrics);
	const overallScore = metrics.healthScore?.overall ?? Math.round(
		(metrics.secureScore * 0.3 + metrics.complianceScore * 0.2 + (metrics.mfaAdoptionRate) * 0.2 + (metrics.activeUsers / Math.max(1, metrics.totalUsers) * 100) * 0.15 + 50 * 0.15)
	);
	const benchmarkSummary = buildBenchmarkSummary(config, metrics, overallScore);
	const shareSnippet = buildShareSnippet(config, metrics, overallScore);

	const report: ExecutiveReport = {
		id: generateReportId(),
		title: `${config.tenantName} Executive Report`,
		subtitle: `${config.reportPeriod.charAt(0).toUpperCase() + config.reportPeriod.slice(1)} Report`,
		generatedAt: new Date().toISOString(),
		period: `${config.periodStart} to ${config.periodEnd}`,
		config,
		executiveSummary,
		overallGrade: overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : 'D',
		overallScore,
		sections,
		keyActions,
		financialSummary: config.includeFinancials ? buildFinancialSummary(metrics) : undefined,
		benchmarkSummary,
		shareSnippet,
		htmlEmail: '',
		shareToken: generateShareToken(),
	};

	report.htmlEmail = buildHtmlEmail(report);
	return report;
}
