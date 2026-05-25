/**
 * Anomaly Detection — Report Generation
 *
 * Generates anomaly reports with risk scoring, summaries,
 * trend analysis, and smart notification digests.
 */

import type { AnomalyEvent, AnomalyReport, TrendPoint } from './types';

export function generateAnomalyReport(
	tenantId: string,
	tenantName: string,
	anomalies: AnomalyEvent[],
	historicalTrend?: TrendPoint[]
): AnomalyReport {
	const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
	const highCount = anomalies.filter((a) => a.severity === 'high').length;

	const riskScore = Math.min(100, criticalCount * 30 + highCount * 15 + anomalies.length * 5);
	const riskLevel: AnomalyReport['riskLevel'] =
		riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : riskScore > 0 ? 'low' : 'none';

	const categorySummary = anomalies.reduce((acc, a) => {
		acc[a.category] = (acc[a.category] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	const summary = anomalies.length === 0
		? `No anomalies detected for ${tenantName}. All metrics within normal ranges.`
		: `${anomalies.length} anomalies detected (${criticalCount} critical, ${highCount} high). ` +
			Object.entries(categorySummary).map(([cat, count]) => `${count} ${cat}`).join(', ') + '.';

	// Smart digest for notifications
	const topAnomaly = anomalies.sort((a, b) => {
		const order = { critical: 0, high: 1, medium: 2, low: 3 };
		return order[a.severity] - order[b.severity];
	})[0];

	const smartDigest = anomalies.length === 0
		? `✅ ${tenantName}: All clear — no anomalies detected.`
		: `🚨 ${tenantName}: ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected. ` +
			(topAnomaly ? `Most urgent: ${topAnomaly.title}` : '');

	// Trend: caller supplies historical points (from DB query of past anomaly
	// runs). When absent, trend contains only today's data — we don't fabricate
	// a 7-day series.
	const today = new Date().toISOString().split('T')[0];
	const todayPoint: TrendPoint = { date: today, anomalyCount: anomalies.length, riskScore };
	const trendAnalysis: TrendPoint[] = historicalTrend
		? [...historicalTrend.filter((p) => p.date !== today), todayPoint]
		: [todayPoint];

	return {
		tenantId,
		tenantName,
		generatedAt: new Date().toISOString(),
		anomalies,
		riskScore,
		riskLevel,
		summary,
		trendAnalysis,
		smartDigest,
	};
}
