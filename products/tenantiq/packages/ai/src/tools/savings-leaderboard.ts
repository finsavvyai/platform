/**
 * Savings Leaderboard & ROI Tracker
 *
 * Gamified savings tracking with:
 * - Real-time ROI dashboard
 * - Cross-tenant leaderboard (MSP)
 * - Achievement badges & milestones
 * - Shareable savings certificates
 * - Monthly savings challenges
 */

export type {
	SavingsEntry,
	ROIMetrics,
	TimelineEntry,
	SavingsBreakdown,
	Achievement,
	SavingsChallenge,
	LeaderboardResult,
	ShareableSavingsCard,
} from './savings-leaderboard-types';

export { computeAchievements } from './savings-leaderboard-achievements';

import type {
	SavingsEntry,
	ROIMetrics,
	TimelineEntry,
	SavingsChallenge,
	LeaderboardResult,
	ShareableSavingsCard,
} from './savings-leaderboard-types';
import { computeAchievements } from './savings-leaderboard-achievements';

// ── ROI Computation ───────────────────────────────────────────────

export function computeROI(
	tenantName: string,
	totalSpend: number,
	monthlySaved: number,
	totalSaved: number,
	wastedCost: number,
	tenantIQMonthlyCost: number = 49, // default plan cost
	historicalTimeline?: TimelineEntry[]
): ROIMetrics {
	const roi = tenantIQMonthlyCost > 0 ? (monthlySaved / tenantIQMonthlyCost) * 100 : 0;
	const paybackDays = monthlySaved > 0 ? Math.round((tenantIQMonthlyCost / monthlySaved) * 30) : 999;

	// Timeline: caller supplies past months from the savings ledger
	// (remediation_log aggregated by month). When absent, only the current
	// month is reported — we don't fabricate prior months.
	const now = new Date();
	const currentMonth: TimelineEntry = {
		month: now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
		saved: monthlySaved,
		cumulative: (historicalTimeline?.reduce((s, e) => s + e.saved, 0) ?? 0) + monthlySaved,
		actions: 0,
	};
	const timeline: TimelineEntry[] = historicalTimeline
		? [...historicalTimeline.filter((e) => e.month !== currentMonth.month), currentMonth]
		: [currentMonth];

	return {
		tenantName,
		totalSpend,
		totalSaved,
		totalWaste: wastedCost,
		roi: Math.round(roi),
		paybackDays,
		savingsTimeline: timeline,
		projectedAnnualSavings: monthlySaved * 12,
		costAvoidance: Math.round(wastedCost * 0.3),
		savingsBreakdown: {
			licenseReclamation: Math.round(monthlySaved * 0.4),
			licenseDowngrade: Math.round(monthlySaved * 0.25),
			inactiveUserCleanup: Math.round(monthlySaved * 0.2),
			duplicateRemoval: Math.round(monthlySaved * 0.1),
			rightSizing: Math.round(monthlySaved * 0.05),
		},
	};
}

// ── Leaderboard Generation ────────────────────────────────────────

function buildChallenges(
	myEntry: SavingsEntry | undefined,
	participantCount: number
): SavingsChallenge[] {
	const endOfMonth = new Date(
		new Date().getFullYear(),
		new Date().getMonth() + 1,
		0
	).toISOString();

	return [
		{
			id: 'ch_monthly_5k',
			title: 'Save $5,000 This Month',
			description: 'Collectively save $5,000 across all optimization actions',
			target: 5000,
			current: myEntry?.monthlySaved ?? 0,
			deadline: endOfMonth,
			reward: '🏆 Gold Badge + Featured on Leaderboard',
			participants: participantCount,
			status: 'active',
		},
		{
			id: 'ch_zero_waste',
			title: 'Zero Waste Challenge',
			description: 'Reduce license waste to 0% for your tenant',
			target: 100,
			current: myEntry?.savingsRate ?? 0,
			deadline: endOfMonth,
			reward: '♻️ Zero Waste Badge',
			participants: Math.round(participantCount * 0.6),
			status: 'active',
		},
	];
}

function buildShareableCard(
	myEntry: SavingsEntry | undefined,
	myRank: number,
	totalCount: number,
	achievements: ReturnType<typeof computeAchievements>
): ShareableSavingsCard {
	const tierBadge = myEntry
		? myEntry.monthlySaved >= 50000
			? '💎 Diamond'
			: myEntry.monthlySaved >= 10000
				? '👑 Platinum'
				: myEntry.monthlySaved >= 5000
					? '🥇 Gold'
					: myEntry.monthlySaved >= 1000
						? '🥈 Silver'
						: '🥉 Bronze'
		: '🌱 Starter';

	return {
		title: `${myEntry?.tenantName ?? 'Your Tenant'} — Savings Report`,
		totalSaved: `$${(myEntry?.totalSaved ?? 0).toLocaleString()} saved`,
		rank: `#${myRank} of ${totalCount} tenants`,
		achievements: achievements
			.filter((a) => a.progress >= 100)
			.slice(0, 4)
			.map((a) => `${a.icon} ${a.title}`),
		badge: tierBadge,
		shareUrl: 'https://app.tenantiq.app/savings',
	};
}

export function generateLeaderboard(
	entries: SavingsEntry[],
	currentTenantId: string,
	period: 'monthly' | 'quarterly' | 'all-time' = 'monthly'
): LeaderboardResult {
	const sorted = [...entries].sort((a, b) => b.monthlySaved - a.monthlySaved);
	sorted.forEach((e, i) => (e.rank = i + 1));

	const myEntry = sorted.find((e) => e.tenantId === currentTenantId);
	const myRank = myEntry?.rank ?? sorted.length + 1;

	const topSaver = sorted[0] || {
		tenantId: '',
		tenantName: 'N/A',
		totalSaved: 0,
		monthlySaved: 0,
		licensesReclaimed: 0,
		downgradesCompleted: 0,
		inactiveUsersDisabled: 0,
		savingsRate: 0,
	};

	const achievements = myEntry ? computeAchievements(myEntry) : [];
	const periodLabels = {
		monthly: 'This Month',
		quarterly: 'This Quarter',
		'all-time': 'All Time',
	};

	return {
		entries: sorted.slice(0, 20),
		myRank,
		totalParticipants: sorted.length,
		periodLabel: periodLabels[period],
		topSaver,
		achievements,
		activeChallenges: buildChallenges(myEntry, sorted.length),
		shareableCard: buildShareableCard(myEntry, myRank, sorted.length, achievements),
	};
}
