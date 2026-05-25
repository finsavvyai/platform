/**
 * Advanced Optimization Rules for TenantIQ Intelligence Engine
 * Enhanced license and cost optimization detection
 *
 * Re-exports all advanced optimization rules from individual modules.
 */

import type { Rule } from '@tenantiq/shared';

export { duplicateLicenses } from './duplicate-licenses.js';
export { seasonalLicenseUsage } from './seasonal-license-usage.js';
export { overProvisionedStorage } from './over-provisioned-storage.js';
export { unusedTeamsLicenses } from './unused-teams-licenses.js';

export type {
	LicenseUser,
	SeasonalUser,
	SignInEntry,
	StorageEntry,
	TeamsActivityEntry,
} from './advanced-optimization-types.js';
export { REDUNDANT_LICENSE_COMBOS, estimateLicenseCost } from './advanced-optimization-types.js';

import { duplicateLicenses } from './duplicate-licenses.js';
import { seasonalLicenseUsage } from './seasonal-license-usage.js';
import { overProvisionedStorage } from './over-provisioned-storage.js';
import { unusedTeamsLicenses } from './unused-teams-licenses.js';

/**
 * All advanced optimization rules
 */
export const advancedOptimizationRules: Rule[] = [
	duplicateLicenses,
	seasonalLicenseUsage,
	overProvisionedStorage,
	unusedTeamsLicenses
];
