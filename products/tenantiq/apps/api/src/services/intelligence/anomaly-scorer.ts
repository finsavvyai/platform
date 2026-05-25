import { LICENSE_PRICING } from './types';

/**
 * Activity score calculation and inactivity severity assessment
 */

/**
 * Calculate activity score (0-100) based on user activity
 */
export function calculateActivityScore(activity: {
	daysSinceSignIn: number;
	hasMailboxActivity: boolean;
	hasTeamsActivity: boolean;
	hasSharePointActivity: boolean;
	teamsChatCount: number;
	teamsCallCount: number;
	sharePointFileCount: number;
}): number {
	let score = 100;

	// Penalize for inactivity
	if (activity.daysSinceSignIn > 90) score -= 60;
	else if (activity.daysSinceSignIn > 60) score -= 40;
	else if (activity.daysSinceSignIn > 30) score -= 20;
	else if (activity.daysSinceSignIn > 7) score -= 10;

	// Reward for service usage (last 7 days)
	if (!activity.hasMailboxActivity) score -= 10;
	if (!activity.hasTeamsActivity) score -= 10;
	if (!activity.hasSharePointActivity) score -= 10;

	// Bonus for high engagement
	if (activity.teamsChatCount > 50) score += 5;
	if (activity.teamsCallCount > 10) score += 5;
	if (activity.sharePointFileCount > 20) score += 5;

	return Math.max(0, Math.min(100, score));
}

/**
 * Determine severity based on days since last sign-in
 */
export function getInactivitySeverity(
	daysSinceSignIn: number
): 'low' | 'medium' | 'high' | 'critical' | null {
	if (daysSinceSignIn >= 90) return 'critical'; // 90+ days: Action required
	if (daysSinceSignIn >= 60) return 'high'; // 60-89 days: High priority
	if (daysSinceSignIn >= 30) return 'medium'; // 30-59 days: Warning
	return null; // < 30 days: No alert
}

/**
 * Calculate monthly license cost for a user
 */
export function calculateLicenseCost(licenses: Array<{ skuId: string }>): number {
	return licenses.reduce((total, license) => {
		return total + (LICENSE_PRICING[license.skuId] || 2000); // Default to $20/month
	}, 0);
}

/**
 * Determine if a license is being used based on activity
 */
export function isLicenseUsed(
	skuId: string,
	activity: {
		hasMailboxActivity: boolean;
		hasTeamsActivity: boolean;
		hasSharePointActivity: boolean;
		teamsChatCount: number;
		teamsCallCount: number;
	}
): boolean {
	// Exchange licenses require mailbox activity
	if (skuId.includes('EXCHANGE')) {
		return activity.hasMailboxActivity;
	}

	// Teams licenses require Teams activity
	if (skuId.includes('TEAMS') || skuId.includes('MCOMEETADV')) {
		return activity.hasTeamsActivity && (activity.teamsChatCount > 0 || activity.teamsCallCount > 0);
	}

	// SharePoint licenses require SharePoint activity
	if (skuId.includes('SHAREPOINT')) {
		return activity.hasSharePointActivity;
	}

	// E3/E5 licenses require any activity
	if (skuId.includes('ENTERPRISE') || skuId.includes('SPE_E')) {
		return activity.hasMailboxActivity || activity.hasTeamsActivity || activity.hasSharePointActivity;
	}

	// Default: consider used if any activity
	return activity.hasMailboxActivity || activity.hasTeamsActivity || activity.hasSharePointActivity;
}

/**
 * Check if user uses E5-exclusive features
 */
export function usesE5Features(activity: {
	hasTeamsActivity: boolean;
	teamsCallCount: number;
	teamsMeetingCount: number;
}): boolean {
	// E5 features include: Audio Conferencing, Phone System, Advanced Compliance, etc.
	// For now, we'll use meeting count as a proxy for Audio Conferencing usage
	return activity.teamsMeetingCount > 5; // More than 5 meetings in 30 days suggests heavy usage
}
