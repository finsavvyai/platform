/**
 * Onboarding Advisor — Combined role-based provisioning templates
 */

import type { ProvisioningPlan } from './types.js';
import { TECHNICAL_TEMPLATES } from './templates-technical.js';
import { BUSINESS_TEMPLATES } from './templates-business.js';

/**
 * All role-based provisioning templates, merged from
 * technical (developer, executive) and business (marketing, sales) sets.
 */
export const ROLE_TEMPLATES: Record<string, Partial<ProvisioningPlan>> = {
	...TECHNICAL_TEMPLATES,
	...BUSINESS_TEMPLATES,
};
