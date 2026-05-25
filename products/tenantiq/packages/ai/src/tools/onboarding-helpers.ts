/**
 * Onboarding Perception — Helper Functions
 * Progress calculation, completion estimation, and notification generation
 */

import type { OnboardingStatus, OnboardingStepStatus } from './onboarding-perception-types';

/**
 * Calculate onboarding progress
 */
export function calculateProgress(steps: OnboardingStepStatus[]): number {
	if (steps.length === 0) return 0;

	const completedSteps = steps.filter((s) => s.status === 'completed').length;
	return Math.round((completedSteps / steps.length) * 100);
}

/**
 * Estimate completion time based on remaining steps
 */
export function estimateCompletion(steps: OnboardingStepStatus[]): string {
	const remainingSteps = steps.filter((s) => s.status === 'pending' || s.status === 'in_progress');

	if (remainingSteps.length === 0) {
		return 'Completed';
	}

	// Assume average 4 minutes per step
	const estimatedMinutes = remainingSteps.length * 4;

	if (estimatedMinutes < 60) {
		return `~${estimatedMinutes} minutes`;
	}

	const hours = Math.floor(estimatedMinutes / 60);
	const minutes = estimatedMinutes % 60;

	if (hours === 1) {
		return minutes > 0 ? `~1 hour ${minutes} minutes` : '~1 hour';
	}

	return minutes > 0 ? `~${hours} hours ${minutes} minutes` : `~${hours} hours`;
}

/**
 * Generate onboarding status update notification
 */
export function generateStatusNotification(
	status: OnboardingStatus,
	recipient: 'employee' | 'manager' | 'hr'
): string {
	const progress = status.progress;
	const employeeFirstName = status.employeeName.split(' ')[0];

	if (recipient === 'employee') {
		if (progress === 0) {
			return `🎉 Welcome ${employeeFirstName}! Your onboarding journey has begun. Complete your Day 1 checklist to get started.`;
		} else if (progress < 50) {
			return `👍 Great start ${employeeFirstName}! You're ${progress}% through onboarding. Keep going!`;
		} else if (progress < 100) {
			return `🚀 Almost there ${employeeFirstName}! You're ${progress}% complete. Just a few more steps!`;
		} else {
			return `✅ Congratulations ${employeeFirstName}! You've completed onboarding. Welcome to the team!`;
		}
	} else if (recipient === 'manager') {
		return `📊 ${status.employeeName} (${status.role}) is ${progress}% through onboarding. Current step: ${status.steps[status.currentStep - 1]?.name || 'Starting'}`;
	} else {
		// HR
		return `📋 Onboarding update: ${status.employeeName} - ${progress}% complete (${status.currentStep}/${status.totalSteps} steps)`;
	}
}
