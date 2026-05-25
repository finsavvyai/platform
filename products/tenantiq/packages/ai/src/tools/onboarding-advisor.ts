/**
 * AI-Powered Onboarding Advisor — Barrel re-export
 * @see ./onboarding-advisor/ for implementation modules
 */

export {
	type OnboardingRequest,
	type ProvisioningPlan,
	type LicenseRecommendation,
	type GroupRecommendation,
	type ApplicationRecommendation,
	type SecurityRecommendation,
	type TimelineStep,
	type ApprovalRequirement,
	analyzePeerUsers,
	generateProvisioningPlan,
	generateOnboardingPrompt,
} from './onboarding-advisor/index.js';
