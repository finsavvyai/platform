/**
 * Usage Heatmaps & Adoption Scoring
 *
 * Visualize M365 service adoption across the organization:
 * - Per-service adoption rates (Teams, SharePoint, Exchange, OneDrive, etc.)
 * - Department-level heatmaps
 * - Time-based usage patterns
 * - Adoption scoring with recommendations
 * - License right-sizing based on actual usage
 */

export type {
	AdoptionRecommendation,
	AdoptionScore,
	DepartmentAdoption,
	LicenseSuggestion,
	ServiceUsage,
	ShareableAdoptionCard,
	TimePattern,
	UsageHeatmapResult,
	UsageInput,
	UsageInsight,
} from './usage-heatmap.types';

export { M365_SERVICES, gradeFromScore, intensityColor } from './usage-heatmap.helpers';

import type {
	AdoptionRecommendation,
	AdoptionScore,
	DepartmentAdoption,
	ServiceUsage,
	ShareableAdoptionCard,
	UsageHeatmapResult,
	UsageInput,
} from './usage-heatmap.types';

import {
	M365_SERVICES,
	generateInsights,
	gradeFromScore,
	intensityColor,
} from './usage-heatmap.helpers';

// ── Main Entry ─────────────────────────────────────────────────────

export function generateUsageHeatmap(
	tenantId: string,
	tenantName: string,
	input: UsageInput,
	period: string = 'Last 30 days'
): UsageHeatmapResult {
	// Only emit services for which we have observed adoption data. Services
	// without data are omitted entirely — UI shows "no data yet" rather than
	// a fabricated number. Trend/sessions/delta fields default to 0 when the
	// caller couldn't supply them (e.g. no prior period to compare against).
	const serviceUsage: ServiceUsage[] = M365_SERVICES.flatMap((svc) => {
		const data = input.serviceAdoption[svc.id];
		if (!data) return [];
		const activeUsers = data.activeUsers;
		const licensedUsers = data.licensedUsers;
		const adoptionRate = licensedUsers > 0 ? Math.round((activeUsers / licensedUsers) * 100) : 0;

		return [{
			service: svc.name,
			icon: svc.icon,
			activeUsers,
			totalLicensed: licensedUsers,
			adoptionRate,
			trend: adoptionRate > 70 ? 'growing' as const : adoptionRate > 40 ? 'stable' as const : 'declining' as const,
			trendDelta: data.trendDelta ?? 0,
			avgSessionsPerWeek: data.avgSessions ?? 0,
			topFeatures: [],
		}];
	});

	const departmentAdoption = buildDepartmentAdoption(input);
	const timePatterns = input.timePatterns ?? [];
	const adoptionScore = buildAdoptionScore(serviceUsage);
	const insights = generateInsights(serviceUsage, adoptionScore);

	const shareableCard: ShareableAdoptionCard = {
		title: `${tenantName} — M365 Adoption`,
		score: adoptionScore.overall,
		grade: gradeFromScore(adoptionScore.overall),
		topServices: [...serviceUsage]
			.sort((a, b) => b.adoptionRate - a.adoptionRate)
			.slice(0, 3)
			.map((s) => ({ name: s.service, rate: s.adoptionRate, icon: s.icon })),
		insight: insights[0]?.title ?? 'Analyzing adoption trends...',
		shareUrl: 'https://app.tenantiq.app/adoption',
	};

	return {
		tenantId,
		tenantName,
		generatedAt: new Date().toISOString(),
		period,
		serviceUsage,
		departmentAdoption,
		timePatterns,
		adoptionScore,
		insights,
		shareableCard,
	};
}

// ── Internal Builders ──────────────────────────────────────────────

function buildDepartmentAdoption(input: UsageInput): DepartmentAdoption[] {
	// No invented departments. If caller didn't supply department mapping
	// (typically from Entra ID department field), return empty.
	if (!input.departments || input.departments.length === 0) return [];

	return input.departments.map((dept) => {
		// Only include services for which the caller supplied an explicit rate
		// for this department.
		const services = M365_SERVICES.slice(0, 6).flatMap((svc) => {
			const rate = dept.serviceRates[svc.id];
			if (rate === undefined) return [];
			return [{ service: svc.name, adoptionRate: rate, color: intensityColor(rate) }];
		});
		const overallScore = services.length > 0
			? Math.round(services.reduce((s, sv) => s + sv.adoptionRate, 0) / services.length)
			: 0;
		return { department: dept.name, userCount: dept.userCount, services, overallScore };
	});
}

function buildAdoptionScore(serviceUsage: ServiceUsage[]): AdoptionScore {
	const avgAdoption = serviceUsage.length > 0
		? Math.round(serviceUsage.reduce((s, sv) => s + sv.adoptionRate, 0) / serviceUsage.length)
		: 0;

	const sortedServices = [...serviceUsage].sort((a, b) => b.adoptionRate - a.adoptionRate);
	const above80 = serviceUsage.filter((s) => s.adoptionRate >= 80).length;
	const below50 = serviceUsage.filter((s) => s.adoptionRate < 50).length;

	const recommendations: AdoptionRecommendation[] = [];
	for (const svc of sortedServices.slice(-3).reverse()) {
		if (svc.adoptionRate < 50) {
			recommendations.push({
				priority: svc.adoptionRate < 20 ? 'high' : 'medium',
				service: svc.service,
				title: `Boost ${svc.service} adoption (${svc.adoptionRate}%)`,
				description: `Only ${svc.activeUsers} of ${svc.totalLicensed} licensed users are active. Consider targeted training.`,
				estimatedImpact: `+${Math.round((70 - svc.adoptionRate) * 0.5)}% adoption increase`,
				actionType: svc.adoptionRate < 20 ? 'training' : 'champion_program',
			});
		}
	}

	return {
		overall: avgAdoption,
		grade: gradeFromScore(avgAdoption),
		servicesAbove80: above80,
		servicesBelow50: below50,
		topService: { name: sortedServices[0]?.service ?? 'N/A', rate: sortedServices[0]?.adoptionRate ?? 0 },
		bottomService: {
			name: sortedServices[sortedServices.length - 1]?.service ?? 'N/A',
			rate: sortedServices[sortedServices.length - 1]?.adoptionRate ?? 0,
		},
		recommendations,
		licenseSuggestions: [],
	};
}
