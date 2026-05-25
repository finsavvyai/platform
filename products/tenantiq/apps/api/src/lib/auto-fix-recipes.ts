/**
 * Auto-fix recipe registry.
 *
 * Each recipe maps a finding shape (drift category + summary regex) to a
 * known-safe Graph mutation. Start tight: only recipes that are
 * deterministically safe for any tenant (revert a CA policy that flipped
 * to report-only, restore a missing legacy-auth block, etc.) ship in v1.
 *
 * Recipe is intentionally NOT pulled from a DB table — it's source-pinned
 * so a misbehaving recipe is reverted by reverting the commit, not by
 * editing live data.
 */

export interface AutoFixRecipe {
	id: string;
	description: string;
	category: string;                     // matches config_drifts.category
	summaryPattern: RegExp;               // matches config_drifts.summary
	severityFloor: 'critical' | 'high' | 'medium' | 'low'; // skip if drift severity below this
	target: { method: 'PATCH' | 'POST' | 'DELETE'; pathTemplate: string; bodyTemplate?: unknown };
	baselinePathTemplate: string;
	humanRationale: string;
}

export const AUTO_FIX_RECIPES: AutoFixRecipe[] = [
	{
		id: 'ca-block-legacy-auth-reverted',
		description: 'CA policy that blocks legacy auth flipped to report-only',
		category: 'conditionalAccess',
		summaryPattern: /block.*legacy.*report-?only|legacy.*auth.*report-?only/i,
		severityFloor: 'high',
		target: {
			method: 'PATCH',
			pathTemplate: '/identity/conditionalAccessPolicies/{policyId}',
			bodyTemplate: { state: 'enabled' },
		},
		baselinePathTemplate: '/identity/conditionalAccessPolicies/{policyId}',
		humanRationale: 'Legacy auth bypasses MFA; if this CA was set to report-only it leaves the tenant exposed to credential-stuffing. Re-enabling enforces the original posture.',
	},
	{
		id: 'auth-methods-policy-weakened-mfa-disabled',
		description: 'Authentication-methods policy disabled the MFA method',
		category: 'authMethods',
		summaryPattern: /authentic.*method.*disabled|mfa.*method.*disabled/i,
		severityFloor: 'high',
		target: {
			method: 'PATCH',
			pathTemplate: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/microsoftAuthenticator',
			bodyTemplate: { state: 'enabled' },
		},
		baselinePathTemplate: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/microsoftAuthenticator',
		humanRationale: 'Microsoft Authenticator being disabled at policy level removes the strongest MFA option. Re-enabling restores the documented baseline.',
	},
];

const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

export function matchRecipe(category: string, summary: string): AutoFixRecipe | null {
	for (const r of AUTO_FIX_RECIPES) {
		if (r.category !== category) continue;
		if (!r.summaryPattern.test(summary)) continue;
		return r;
	}
	return null;
}

export function severityMeetsFloor(
	driftSeverity: string,
	floor: AutoFixRecipe['severityFloor'],
): boolean {
	const a = SEVERITY_RANK[driftSeverity as keyof typeof SEVERITY_RANK] ?? 0;
	const b = SEVERITY_RANK[floor];
	return a >= b;
}
