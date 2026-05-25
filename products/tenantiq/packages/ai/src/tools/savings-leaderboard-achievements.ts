/**
 * Savings Leaderboard — Achievement Definitions & Computation
 *
 * Badge definitions and progress calculation logic
 * for gamified savings tracking.
 */

import type { Achievement, SavingsEntry } from './savings-leaderboard-types';

// ── Achievement Definitions ────────────────────────────────────────

const ACHIEVEMENTS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
	{
		id: 'first_save',
		title: 'First Dollar Saved',
		description: 'Reclaim your first wasted license',
		icon: '🌱',
		tier: 'bronze',
		requirement: 'Save $1+',
	},
	{
		id: 'hundred_club',
		title: 'Hundred Dollar Club',
		description: 'Save $100/month in license costs',
		icon: '💯',
		tier: 'bronze',
		requirement: 'Save $100+/mo',
	},
	{
		id: 'thousand_saver',
		title: 'Thousand Dollar Saver',
		description: 'Save $1,000/month in license costs',
		icon: '💎',
		tier: 'silver',
		requirement: 'Save $1,000+/mo',
	},
	{
		id: 'five_k_hero',
		title: '$5K Optimization Hero',
		description: 'Save $5,000/month — you\'re a cost optimization hero',
		icon: '🦸',
		tier: 'gold',
		requirement: 'Save $5,000+/mo',
	},
	{
		id: 'ten_k_legend',
		title: '$10K Legend',
		description: 'Save $10,000/month — legendary optimization',
		icon: '👑',
		tier: 'platinum',
		requirement: 'Save $10,000+/mo',
	},
	{
		id: 'fifty_k_titan',
		title: '$50K Titan',
		description: 'Save $50,000/month — titan-level cost management',
		icon: '🏆',
		tier: 'diamond',
		requirement: 'Save $50,000+/mo',
	},
	{
		id: 'license_hunter',
		title: 'License Hunter',
		description: 'Reclaim 10+ unused licenses',
		icon: '🎯',
		tier: 'bronze',
		requirement: 'Reclaim 10+ licenses',
	},
	{
		id: 'license_master',
		title: 'License Master',
		description: 'Reclaim 50+ unused licenses',
		icon: '🏹',
		tier: 'silver',
		requirement: 'Reclaim 50+ licenses',
	},
	{
		id: 'cleanup_crew',
		title: 'Cleanup Crew',
		description: 'Disable 20+ inactive users',
		icon: '🧹',
		tier: 'bronze',
		requirement: 'Disable 20+ inactive users',
	},
	{
		id: 'downgrade_pro',
		title: 'Downgrade Pro',
		description: 'Successfully downgrade 10+ E5 to E3 licenses',
		icon: '📉',
		tier: 'silver',
		requirement: 'Downgrade 10+ licenses',
	},
	{
		id: 'roi_champion',
		title: 'ROI Champion',
		description: 'Achieve 500%+ ROI on TenantIQ',
		icon: '📈',
		tier: 'gold',
		requirement: '500%+ ROI',
	},
	{
		id: 'zero_waste',
		title: 'Zero Waste',
		description: 'Achieve 0% license waste rate',
		icon: '♻️',
		tier: 'platinum',
		requirement: '0% waste',
	},
	{
		id: 'streak_7',
		title: 'Weekly Warrior',
		description: 'Optimize costs 7 days in a row',
		icon: '🔥',
		tier: 'bronze',
		requirement: '7-day optimization streak',
	},
	{
		id: 'streak_30',
		title: 'Monthly Master',
		description: 'Maintain optimization for 30 consecutive days',
		icon: '🌟',
		tier: 'gold',
		requirement: '30-day optimization streak',
	},
];

// ── Progress Computation ──────────────────────────────────────────

const SAVINGS_THRESHOLDS: Record<string, (e: SavingsEntry) => number> = {
	first_save: (e) => (e.totalSaved > 0 ? 100 : 0),
	hundred_club: (e) => Math.min(100, (e.monthlySaved / 100) * 100),
	thousand_saver: (e) => Math.min(100, (e.monthlySaved / 1000) * 100),
	five_k_hero: (e) => Math.min(100, (e.monthlySaved / 5000) * 100),
	ten_k_legend: (e) => Math.min(100, (e.monthlySaved / 10000) * 100),
	fifty_k_titan: (e) => Math.min(100, (e.monthlySaved / 50000) * 100),
	license_hunter: (e) => Math.min(100, (e.licensesReclaimed / 10) * 100),
	license_master: (e) => Math.min(100, (e.licensesReclaimed / 50) * 100),
	cleanup_crew: (e) => Math.min(100, (e.inactiveUsersDisabled / 20) * 100),
	downgrade_pro: (e) => Math.min(100, (e.downgradesCompleted / 10) * 100),
	roi_champion: (e) => Math.min(100, (e.savingsRate / 5) * 100),
	zero_waste: (e) => (e.savingsRate >= 100 ? 100 : Math.min(99, e.savingsRate)),
};

export function computeAchievements(entry: SavingsEntry): Achievement[] {
	return ACHIEVEMENTS.map((a) => {
		const calc = SAVINGS_THRESHOLDS[a.id];
		const progress = Math.round(calc ? calc(entry) : 0);

		return {
			...a,
			progress,
			unlockedAt: progress >= 100 ? new Date().toISOString() : undefined,
		};
	});
}
