/**
 * AI-Powered Onboarding Advisor
 * Intelligent user provisioning based on role, department, and peer analysis
 *
 * Re-exports all public API from submodules.
 */

export type {
	OnboardingRequest,
	ProvisioningPlan,
	LicenseRecommendation,
	GroupRecommendation,
	ApplicationRecommendation,
	SecurityRecommendation,
	TimelineStep,
	ApprovalRequirement,
} from './types.js';

export { analyzePeerUsers } from './peer-analysis.js';
export { generateProvisioningPlan } from './plan-generator.js';
export { generateOnboardingPrompt } from './prompt-generator.js';
