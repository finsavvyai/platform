/**
 * SEC-009: Weak Password Policy Detection
 * Identifies weak password policies
 */

import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import type { PasswordPolicy } from './advanced-security-types';

export const weakPasswordPolicy: Rule = {
	id: 'SEC-009',
	name: 'Weak password policy detected',
	severity: 'medium',
	category: 'security',
	remediationType: 'manual',
	async evaluate(_tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const passwordPolicies = ((data as any).passwordPolicies ?? []) as PasswordPolicy[];

		const issues: string[] = [];

		passwordPolicies.forEach(policy => {
			if ((policy.minimumLength ?? 0) < 12) {
				issues.push(`Minimum password length is ${policy.minimumLength} (recommended: 12+)`);
			}

			if (!policy.requireUppercase || !policy.requireLowercase) {
				issues.push('Case requirements not enforced');
			}

			if (!policy.requireNumbers) {
				issues.push('Number requirements not enforced');
			}

			if (!policy.requireSymbols) {
				issues.push('Symbol requirements not enforced');
			}

			if (policy.passwordExpirationDays && policy.passwordExpirationDays < 90) {
				issues.push(`Password expiration too frequent (${policy.passwordExpirationDays} days)`);
			}
		});

		if (issues.length > 0) {
			return [{
				ruleId: 'SEC-009',
				title: 'Password policy does not meet security best practices',
				description: 'Current password policy configuration has weaknesses that increase vulnerability to attacks.',
				businessImpact: 'Medium: Weak passwords are easier to crack through brute force or dictionary attacks',
				affectedResources: issues.map(issue => ({ type: 'policy', description: issue })),
				recommendedAction: 'Strengthen password policy: minimum 12 characters, complexity requirements, and appropriate expiration.'
			}];
		}

		return [];
	}
};
