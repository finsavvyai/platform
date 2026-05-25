/**
 * Onboarding Perception & UX Enhancements
 * Progress tracking, notifications, welcome emails, and analytics
 *
 * Barrel file — re-exports from split modules
 */

// Types
export type {
	OnboardingStatus,
	OnboardingStepStatus,
	WelcomeEmail,
	WelcomeEmailAttachment,
	OnboardingChecklist,
	ChecklistItem,
	ChecklistResource,
	OnboardingMetrics,
	RoleMetrics,
	DepartmentMetrics,
	IssueMetric,
} from './onboarding-perception-types';

// Welcome email generation
export { generateWelcomeEmail } from './onboarding-welcome-email';

// Checklist generation
export { generateOnboardingChecklist } from './onboarding-checklist';

// Helpers: progress, estimation, notifications
export {
	calculateProgress,
	estimateCompletion,
	generateStatusNotification,
} from './onboarding-helpers';
