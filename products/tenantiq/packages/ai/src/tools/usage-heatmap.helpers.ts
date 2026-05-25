/**
 * Usage Heatmap & Adoption Scoring — Helpers, Constants & Formatters
 */

import type { AdoptionScore, ServiceUsage, UsageInsight } from './usage-heatmap.types';

// ── Service Definitions ────────────────────────────────────────────

export const M365_SERVICES = [
	{ id: 'teams', name: 'Microsoft Teams', icon: '💬', category: 'communication' },
	{ id: 'exchange', name: 'Exchange Online', icon: '📧', category: 'communication' },
	{ id: 'sharepoint', name: 'SharePoint Online', icon: '📁', category: 'collaboration' },
	{ id: 'onedrive', name: 'OneDrive for Business', icon: '☁️', category: 'storage' },
	{ id: 'outlook', name: 'Outlook', icon: '📮', category: 'communication' },
	{ id: 'word', name: 'Word', icon: '📝', category: 'productivity' },
	{ id: 'excel', name: 'Excel', icon: '📊', category: 'productivity' },
	{ id: 'powerpoint', name: 'PowerPoint', icon: '📽️', category: 'productivity' },
	{ id: 'power_bi', name: 'Power BI', icon: '📈', category: 'analytics' },
	{ id: 'power_automate', name: 'Power Automate', icon: '⚡', category: 'automation' },
	{ id: 'intune', name: 'Microsoft Intune', icon: '🔒', category: 'security' },
	{ id: 'defender', name: 'Microsoft Defender', icon: '🛡️', category: 'security' },
] as const;

// ── Scoring & Formatting ──────────────────────────────────────────

export function gradeFromScore(score: number): string {
	if (score >= 90) return 'A+';
	if (score >= 80) return 'A';
	if (score >= 70) return 'B';
	if (score >= 60) return 'C';
	if (score >= 45) return 'D';
	return 'F';
}

export function intensityColor(rate: number): string {
	if (rate >= 80) return '#10b981';
	if (rate >= 60) return '#34d399';
	if (rate >= 40) return '#fbbf24';
	if (rate >= 20) return '#f97316';
	return '#ef4444';
}

// Time-pattern generation removed. Callers must supply real per-hour activity
// data (Microsoft Graph getOffice365ActiveUserCounts / getEmailActivityCounts)
// via UsageInput.timePatterns. The previous synthetic 9-to-5 weekday curve was
// indistinguishable from real data in the UI, so we no longer produce one.

// ── Insight Generation ────────────────────────────────────────────

export function generateInsights(services: ServiceUsage[], adoptionScore: AdoptionScore): UsageInsight[] {
	const insights: UsageInsight[] = [];

	const highAdoption = services.filter((s) => s.adoptionRate >= 90);
	if (highAdoption.length > 0) {
		insights.push({
			type: 'achievement',
			icon: '🏆',
			title: `${highAdoption.length} services above 90% adoption`,
			detail: highAdoption.map((s) => `${s.icon} ${s.service}`).join(', '),
			metric: `${highAdoption.length}/${services.length}`,
		});
	}

	const lowAdoption = services.filter((s) => s.adoptionRate < 30 && s.totalLicensed > 0);
	if (lowAdoption.length > 0) {
		insights.push({
			type: 'risk',
			icon: '⚠️',
			title: `${lowAdoption.length} services with critically low adoption`,
			detail: `${lowAdoption.map((s) => s.service).join(', ')} — consider training or removing licenses`,
		});
	}

	const midAdoption = services.filter((s) => s.adoptionRate >= 40 && s.adoptionRate < 70);
	if (midAdoption.length > 0) {
		insights.push({
			type: 'opportunity',
			icon: '🚀',
			title: `${midAdoption.length} services ready for growth`,
			detail: `${midAdoption.map((s) => s.service).join(', ')} — targeted campaigns could boost adoption 20-30%`,
		});
	}

	const teams = services.find((s) => s.service === 'Microsoft Teams');
	const exchange = services.find((s) => s.service === 'Exchange Online');
	if (teams && exchange && teams.adoptionRate > exchange.adoptionRate + 15) {
		insights.push({
			type: 'opportunity',
			icon: '💡',
			title: 'Teams leading over Exchange',
			detail: `Teams adoption (${teams.adoptionRate}%) exceeds Exchange (${exchange.adoptionRate}%) — modern collaboration trending up`,
		});
	}

	if (adoptionScore.overall >= 80) {
		insights.push({
			type: 'achievement',
			icon: '⭐',
			title: 'Best-in-class adoption',
			detail: `Overall adoption score of ${adoptionScore.overall}/100 puts your org in the top tier`,
		});
	}

	return insights;
}
