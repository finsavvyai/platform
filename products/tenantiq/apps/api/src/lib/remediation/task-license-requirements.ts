/**
 * Task → required Microsoft 365 license SKU mapping (T2.2).
 *
 * Each REM_* remediation action requires a minimum tenant license tier
 * to execute via Graph. If the tenant doesn't have the SKU, surface an
 * upsell instead of a "click to remediate" button.
 *
 * SKU IDs use Microsoft "skuPartNumber" — match against /subscribedSkus.
 *
 * Sources:
 *  - learn.microsoft.com/en-us/azure/active-directory/enterprise-users/
 *  - graph.microsoft.com/v1.0/subscribedSkus naming
 */

import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export type RequiredSkuMatcher = {
	/** Match any of these skuPartNumber values (case-insensitive substring). */
	anyOf: string[];
	/** Display name for the upsell card. */
	display: string;
	/** Why this SKU is needed for this action. */
	reason: string;
	/** Approximate Microsoft list price per user/month, USD. */
	priceUsdPerUserPerMonth: number;
};

const ENTRA_P1: RequiredSkuMatcher = {
	anyOf: ['AAD_PREMIUM', 'AAD_PREMIUM_P1', 'EMS', 'EMSPREMIUM', 'ENTERPRISEPACK', 'ENTERPRISEPREMIUM', 'SPE_E3', 'SPE_E5'],
	display: 'Entra ID P1',
	reason: 'Conditional Access policies, group-based licensing, and dynamic groups require Entra ID P1.',
	priceUsdPerUserPerMonth: 6,
};

const ENTRA_P2: RequiredSkuMatcher = {
	anyOf: ['AAD_PREMIUM_P2', 'EMSPREMIUM', 'ENTERPRISEPREMIUM', 'SPE_E5'],
	display: 'Entra ID P2',
	reason: 'PIM, Identity Protection (sign-in risk + user risk policies), and access reviews require Entra ID P2.',
	priceUsdPerUserPerMonth: 9,
};

/** Required SKU per remediation action ID. Null = no premium SKU required. */
export const TASK_LICENSE_REQUIREMENTS: Record<string, RequiredSkuMatcher | null> = {
	[REMEDIATION_ACTION_IDS.REM_001]: null,                 // Decommission user — base
	[REMEDIATION_ACTION_IDS.REM_002]: ENTRA_P1,             // Enable MFA Policy via CA
	[REMEDIATION_ACTION_IDS.REM_003]: ENTRA_P1,             // Block IP via CA named locations
	[REMEDIATION_ACTION_IDS.REM_004]: null,                 // Downgrade License — base
	[REMEDIATION_ACTION_IDS.REM_005]: null,                 // Revoke sessions — base
	[REMEDIATION_ACTION_IDS.REM_006]: null,                 // Force password reset — base
	[REMEDIATION_ACTION_IDS.REM_007]: null,                 // Remove guest user — base
	[REMEDIATION_ACTION_IDS.REM_008]: null,                 // Restrict external sharing — SP admin
	[REMEDIATION_ACTION_IDS.REM_009]: ENTRA_P1,             // Enable Conditional Access policy
};

export interface SubscribedSkuLite {
	skuPartNumber?: string;
	skuId?: string;
	prepaidUnits?: { enabled?: number };
	consumedUnits?: number;
}

/**
 * Returns the upsell required to enable the given remediation action,
 * or null if the tenant already has it (or the action requires no premium SKU).
 */
export function checkRequiredSku(
	actionType: string,
	tenantSkus: SubscribedSkuLite[],
): RequiredSkuMatcher | null {
	const requirement = TASK_LICENSE_REQUIREMENTS[actionType];
	if (!requirement) return null;

	const ownedSkuParts = new Set(
		tenantSkus
			.map(s => s.skuPartNumber?.toUpperCase())
			.filter((s): s is string => !!s),
	);

	const owned = requirement.anyOf.some(needed =>
		[...ownedSkuParts].some(have => have === needed.toUpperCase() || have.includes(needed.toUpperCase())),
	);

	return owned ? null : requirement;
}

export interface UpsellSurfaceInfo {
	required: RequiredSkuMatcher;
	suggestedSeats: number;
	estimatedMonthlyCostUsd: number;
}

/**
 * Convert a SKU requirement + estimated affected user count into a concrete
 * upsell surface (cost, seat count) the UI can display.
 */
export function buildUpsell(
	required: RequiredSkuMatcher,
	affectedUsers: number,
): UpsellSurfaceInfo {
	const seats = Math.max(1, affectedUsers);
	return {
		required,
		suggestedSeats: seats,
		estimatedMonthlyCostUsd: Math.round(seats * required.priceUsdPerUserPerMonth),
	};
}
