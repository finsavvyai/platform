/**
 * Advanced Security Rules for TenantIQ Intelligence Engine
 * Enhanced detection capabilities for sophisticated threats
 *
 * Re-exports all advanced security rules and types from split modules.
 */

import type { Rule } from '@tenantiq/shared';

export { privilegedAccountAnomaly } from './privileged-account-anomaly';
export { suspiciousOAuthConsent } from './suspicious-oauth-consent';
export { weakPasswordPolicy } from './weak-password-policy';
export { dataExfiltrationRisk } from './data-exfiltration-risk';

export type {
	SignInLog,
	AdminUser,
	ServicePrincipal,
	PasswordPolicy,
	FileActivity
} from './advanced-security-types';

import { privilegedAccountAnomaly } from './privileged-account-anomaly';
import { suspiciousOAuthConsent } from './suspicious-oauth-consent';
import { weakPasswordPolicy } from './weak-password-policy';
import { dataExfiltrationRisk } from './data-exfiltration-risk';

/**
 * Export all advanced security rules
 */
export const advancedSecurityRules: Rule[] = [
	privilegedAccountAnomaly,
	suspiciousOAuthConsent,
	weakPasswordPolicy,
	dataExfiltrationRisk
];
