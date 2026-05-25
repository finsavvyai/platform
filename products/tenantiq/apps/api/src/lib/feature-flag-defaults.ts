/**
 * Default Feature Flags — TenantIQ initial flag set.
 *
 * These are seeded on first deploy / engine init.
 * Once in KV they can be toggled via the admin API.
 */

import type { FeatureFlag } from './feature-flags-engine';

function makeFlag(
	key: string,
	description: string,
	enabled: boolean,
	rolloutPercentage: number,
	opts?: { targetPlans?: string[]; targetOrgs?: string[] },
): FeatureFlag {
	const now = Date.now();
	return {
		key,
		enabled,
		description,
		rolloutPercentage,
		targetOrgs: opts?.targetOrgs,
		targetPlans: opts?.targetPlans,
		createdAt: now,
		updatedAt: now,
	};
}

export const DEFAULT_FLAGS: FeatureFlag[] = [
	makeFlag('copilot-readiness', 'Copilot Readiness Assessment feature', true, 100),
	makeFlag('config-drift', 'Config drift detection', true, 100),
	makeFlag('storage-analytics', 'Storage analytics dashboard', true, 80),
	makeFlag('enterprise-sso', 'Enterprise SAML/OIDC SSO', false, 0),
	makeFlag('ai-self-learning', 'AI feedback loop for improving recommendations', true, 50),
	makeFlag('smart-router', 'Smart AI pathway routing', true, 100),
	makeFlag('semantic-cache', 'Fuzzy question cache matching', true, 100),
];
