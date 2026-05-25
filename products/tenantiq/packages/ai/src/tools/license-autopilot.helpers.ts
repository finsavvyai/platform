/**
 * License Reclamation Autopilot — Analysis Helpers
 */

import { DOWNGRADE_PATHS } from './license-autopilot.data';
import type { AutopilotConfig, LicenseCandidate, ReclamationAction, UserLicenseData } from './license-autopilot.types';

export function daysSince(dateStr: string | null): number {
	if (!dateStr) return 999;
	const diff = Date.now() - new Date(dateStr).getTime();
	return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function computeUsageScore(user: UserLicenseData): number {
	const signinDays = daysSince(user.lastSignIn);
	const nonInteractiveDays = daysSince(user.lastNonInteractiveSignIn);
	const bestActivity = Math.min(signinDays, nonInteractiveDays);

	if (!user.accountEnabled) return 0;
	if (bestActivity <= 1) return 100;
	if (bestActivity <= 7) return 85;
	if (bestActivity <= 14) return 70;
	if (bestActivity <= 30) return 50;
	if (bestActivity <= 60) return 25;
	if (bestActivity <= 90) return 10;
	return 0;
}

interface ActionResult {
	action: ReclamationAction;
	reason: string;
	confidence: number;
	riskLevel: LicenseCandidate['riskLevel'];
	riskNote?: string;
}

export function determineLicenseAction(
	user: UserLicenseData,
	usageScore: number,
	config: AutopilotConfig
): ActionResult {
	if (config.excludedUsers.includes(user.email)) {
		return { action: 'keep', reason: 'User excluded from autopilot', confidence: 100, riskLevel: 'none' };
	}

	if (!user.accountEnabled) {
		return {
			action: 'remove',
			reason: 'Account disabled — license not needed',
			confidence: 95,
			riskLevel: 'none',
		};
	}

	const inactiveDays = daysSince(user.lastSignIn);

	if (inactiveDays > config.inactivityThreshold * 2) {
		return {
			action: 'remove',
			reason: `No sign-in for ${inactiveDays} days (2× threshold)`,
			confidence: 90,
			riskLevel: 'low',
			riskNote: 'User may return — consider grace period notification',
		};
	}

	if (inactiveDays > config.inactivityThreshold) {
		return {
			action: 'remove',
			reason: `No sign-in for ${inactiveDays} days (exceeds ${config.inactivityThreshold}-day threshold)`,
			confidence: 80,
			riskLevel: 'medium',
			riskNote: 'Send warning email before reclaiming',
		};
	}

	if (usageScore < config.usageScoreThreshold && usageScore > 0) {
		const hasDowngradePath = user.licenses.some((l) => DOWNGRADE_PATHS[l]);
		if (hasDowngradePath) {
			return {
				action: 'downgrade',
				reason: `Low usage score (${usageScore}/100) — can downgrade to cheaper tier`,
				confidence: 75,
				riskLevel: 'low',
				riskNote: 'Monitor usage after downgrade for 30 days',
			};
		}
		return {
			action: 'flag_for_review',
			reason: `Low usage score (${usageScore}/100) — needs manual review`,
			confidence: 60,
			riskLevel: 'medium',
		};
	}

	return { action: 'keep', reason: 'Active user', confidence: 100, riskLevel: 'none' };
}
