/**
 * License Reclamation Autopilot
 *
 * Automated license optimization that:
 * - Identifies unused/underused licenses
 * - Suggests downgrades (E5->E3, E3->E1)
 * - Runs reclamation workflows with approval gates
 * - Tracks savings over time
 * - Generates before/after comparisons
 */

// ── Re-exports (public API) ──────────────────────────────────────
export type {
	LicenseCandidate,
	ReclamationAction,
	ReclamationPlan,
	ReclamationSummary,
	ExecutionStep,
	LicenseSnapshot,
	AutopilotConfig,
	UserLicenseData,
} from './license-autopilot.types';

export { LICENSE_COSTS, DOWNGRADE_PATHS } from './license-autopilot.data';
export { daysSince, computeUsageScore, determineLicenseAction } from './license-autopilot.helpers';

// ── Imports for local use ─────────────────────────────────────────
import { LICENSE_COSTS, DOWNGRADE_PATHS } from './license-autopilot.data';
import { daysSince, computeUsageScore, determineLicenseAction } from './license-autopilot.helpers';
import type {
	AutopilotConfig,
	ExecutionStep,
	LicenseCandidate,
	LicenseSnapshot,
	ReclamationPlan,
	UserLicenseData,
} from './license-autopilot.types';

// ── Plan Generation ───────────────────────────────────────────────

function generatePlanId(): string {
	return `rclm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function analyzeReclamationCandidates(
	users: UserLicenseData[],
	config: AutopilotConfig
): LicenseCandidate[] {
	const candidates: LicenseCandidate[] = [];

	for (const user of users) {
		const usageScore = computeUsageScore(user);
		const { action, reason, confidence, riskLevel, riskNote } = determineLicenseAction(user, usageScore, config);

		if (action === 'keep') continue;

		for (const sku of user.licenses) {
			if (config.excludedSkus.includes(sku)) continue;

			const licenseInfo = LICENSE_COSTS[sku];
			if (!licenseInfo) continue;

			const inactiveDays = daysSince(user.lastSignIn);
			let monthlySavings = 0;
			let suggestedLicense: string | undefined;
			let suggestedLicenseCost: number | undefined;

			if (action === 'remove') {
				monthlySavings = licenseInfo.monthlyCost;
			} else if (action === 'downgrade') {
				const path = DOWNGRADE_PATHS[sku];
				if (path) {
					suggestedLicense = LICENSE_COSTS[path.target]?.name ?? path.target;
					suggestedLicenseCost = LICENSE_COSTS[path.target]?.monthlyCost ?? 0;
					monthlySavings = path.savings;
				}
			}

			if (monthlySavings > 0) {
				candidates.push({
					userId: user.userId,
					userEmail: user.email,
					displayName: user.displayName,
					currentLicense: licenseInfo.name,
					currentLicenseCost: licenseInfo.monthlyCost,
					lastActiveDate: user.lastSignIn,
					inactiveDays,
					usageScore,
					action,
					suggestedLicense,
					suggestedLicenseCost,
					monthlySavings,
					annualSavings: monthlySavings * 12,
					confidence,
					reason,
					riskLevel,
					riskNote,
				});
			}
		}
	}

	return candidates
		.sort((a, b) => b.monthlySavings - a.monthlySavings)
		.slice(0, config.maxActionsPerRun);
}

export function generateReclamationPlan(
	tenantId: string,
	tenantName: string,
	candidates: LicenseCandidate[],
	currentSnapshot: LicenseSnapshot,
	config: AutopilotConfig
): ReclamationPlan {
	const removals = candidates.filter((c) => c.action === 'remove');
	const downgrades = candidates.filter((c) => c.action === 'downgrade');
	const reassignments = candidates.filter((c) => c.action === 'reassign');
	const flagged = candidates.filter((c) => c.action === 'flag_for_review');

	const totalMonthlySavings = candidates.reduce((sum, c) => sum + c.monthlySavings, 0);
	const avgConfidence = candidates.length > 0
		? Math.round(candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length)
		: 0;

	const riskBreakdown = {
		none: candidates.filter((c) => c.riskLevel === 'none').length,
		low: candidates.filter((c) => c.riskLevel === 'low').length,
		medium: candidates.filter((c) => c.riskLevel === 'medium').length,
		high: candidates.filter((c) => c.riskLevel === 'high').length,
	};

	const executionLog: ExecutionStep[] = candidates.map((c, i) => ({
		step: i + 1,
		action: c.action === 'remove' ? `Remove ${c.currentLicense} from ${c.userEmail}` :
			c.action === 'downgrade' ? `Downgrade ${c.userEmail}: ${c.currentLicense} → ${c.suggestedLicense}` :
			`Flag ${c.userEmail} for review`,
		target: c.userEmail,
		status: 'pending' as const,
		rollbackAvailable: true,
	}));

	const needsApproval = totalMonthlySavings > config.autoApproveBelow || riskBreakdown.high > 0;

	return {
		id: generatePlanId(),
		tenantId,
		tenantName,
		generatedAt: new Date().toISOString(),
		candidates,
		summary: {
			totalCandidates: candidates.length,
			removals: removals.length,
			downgrades: downgrades.length,
			reassignments: reassignments.length,
			flaggedForReview: flagged.length,
			monthlySavings: totalMonthlySavings,
			annualSavings: totalMonthlySavings * 12,
			avgConfidence,
			riskBreakdown,
		},
		approvalRequired: needsApproval,
		status: config.dryRunMode ? 'draft' : needsApproval ? 'pending_approval' : 'approved',
		executionLog,
		beforeSnapshot: currentSnapshot,
	};
}

export function getDefaultAutopilotConfig(): AutopilotConfig {
	return {
		enabled: true,
		inactivityThreshold: 60,
		usageScoreThreshold: 30,
		autoApproveBelow: 100,
		notifyOnReclamation: true,
		excludedUsers: [],
		excludedSkus: [],
		maxActionsPerRun: 50,
		dryRunMode: true,
		schedule: 'weekly',
	};
}
