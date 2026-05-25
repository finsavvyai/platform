/**
 * Savings Leaderboard — Type Definitions
 *
 * Shared interfaces for savings tracking, ROI metrics,
 * achievements, challenges, and shareable cards.
 */

// ── Savings & ROI ─────────────────────────────────────────────────

export interface SavingsEntry {
	tenantId: string;
	tenantName: string;
	totalSaved: number;
	monthlySaved: number;
	licensesReclaimed: number;
	downgradesCompleted: number;
	inactiveUsersDisabled: number;
	savingsRate: number; // percentage of total spend
	rank?: number;
}

export interface ROIMetrics {
	tenantName: string;
	totalSpend: number;
	totalSaved: number;
	totalWaste: number;
	roi: number; // percentage
	paybackDays: number;
	savingsTimeline: TimelineEntry[];
	projectedAnnualSavings: number;
	costAvoidance: number; // prevented future waste
	savingsBreakdown: SavingsBreakdown;
}

export interface TimelineEntry {
	month: string;
	saved: number;
	cumulative: number;
	actions: number;
}

export interface SavingsBreakdown {
	licenseReclamation: number;
	licenseDowngrade: number;
	inactiveUserCleanup: number;
	duplicateRemoval: number;
	rightSizing: number;
}

// ── Gamification ──────────────────────────────────────────────────

export interface Achievement {
	id: string;
	title: string;
	description: string;
	icon: string;
	tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
	unlockedAt?: string;
	progress: number; // 0-100
	requirement: string;
}

export interface SavingsChallenge {
	id: string;
	title: string;
	description: string;
	target: number;
	current: number;
	deadline: string;
	reward: string;
	participants: number;
	status: 'active' | 'completed' | 'expired';
}

// ── Leaderboard Result ────────────────────────────────────────────

export interface LeaderboardResult {
	entries: SavingsEntry[];
	myRank: number;
	totalParticipants: number;
	periodLabel: string;
	topSaver: SavingsEntry;
	achievements: Achievement[];
	activeChallenges: SavingsChallenge[];
	shareableCard: ShareableSavingsCard;
}

export interface ShareableSavingsCard {
	title: string;
	totalSaved: string;
	rank: string;
	achievements: string[];
	badge: string;
	shareUrl: string;
}
