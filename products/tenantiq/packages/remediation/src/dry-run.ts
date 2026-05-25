import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

/**
 * Dry-run result describing what a remediation action WOULD change.
 */
export interface DryRunPreview {
	changes: Array<{
		resource: string;
		field: string;
		currentValue: string;
		proposedValue: string;
	}>;
	estimatedDuration: string;
	reversible: boolean;
	affectedResources: number;
}

type ActionType = (typeof REMEDIATION_ACTION_IDS)[keyof typeof REMEDIATION_ACTION_IDS];

interface ActionPreviewConfig {
	getChanges: (params: Record<string, unknown>) => DryRunPreview['changes'];
	estimatedDuration: string;
	reversible: boolean;
}

const targetName = (params: Record<string, unknown>): string =>
	(params.name as string) ?? (params.email as string) ?? (params.targetId as string) ?? 'unknown';

const ACTION_PREVIEWS: Record<ActionType, ActionPreviewConfig> = {
	[REMEDIATION_ACTION_IDS.REM_001]: {
		getChanges: (params) => [
			{ resource: 'User Account', field: 'accountEnabled', currentValue: 'true', proposedValue: 'false' },
			{ resource: 'User Sessions', field: 'activeSessions', currentValue: 'active', proposedValue: 'revoked' },
			{ resource: 'Licenses', field: 'assignedLicenses', currentValue: `${params.licenseCount ?? 'N/A'} licenses`, proposedValue: '0 licenses' },
		],
		estimatedDuration: '15-30 seconds',
		reversible: true,
	},
	[REMEDIATION_ACTION_IDS.REM_002]: {
		getChanges: () => [
			{ resource: 'Conditional Access Policy', field: 'state', currentValue: 'disabled', proposedValue: 'enabled' },
			{ resource: 'Conditional Access Policy', field: 'grantControls', currentValue: 'none', proposedValue: 'mfa required' },
		],
		estimatedDuration: '5-10 seconds',
		reversible: true,
	},
	[REMEDIATION_ACTION_IDS.REM_003]: {
		getChanges: (params) => [
			{ resource: 'Named Location', field: 'ipRanges', currentValue: 'none', proposedValue: String(params.ip ?? params.ipRange ?? 'specified range') },
			{ resource: 'Conditional Access Policy', field: 'grantControls', currentValue: 'allow', proposedValue: 'block' },
		],
		estimatedDuration: '10-20 seconds',
		reversible: true,
	},
	[REMEDIATION_ACTION_IDS.REM_004]: {
		getChanges: (params) => [
			{ resource: `User: ${targetName(params)}`, field: 'license', currentValue: String(params.currentSkuId ?? 'premium'), proposedValue: String(params.targetSkuId ?? 'basic') },
		],
		estimatedDuration: '10-15 seconds',
		reversible: true,
	},
	[REMEDIATION_ACTION_IDS.REM_005]: {
		getChanges: (params) => [
			{ resource: `User: ${targetName(params)}`, field: 'activeSessions', currentValue: 'active', proposedValue: 'revoked' },
		],
		estimatedDuration: '5-10 seconds',
		reversible: false,
	},
	[REMEDIATION_ACTION_IDS.REM_006]: {
		getChanges: (params) => [
			{ resource: `User: ${targetName(params)}`, field: 'forceChangePasswordNextSignIn', currentValue: 'false', proposedValue: 'true' },
		],
		estimatedDuration: '5-10 seconds',
		reversible: false,
	},
	[REMEDIATION_ACTION_IDS.REM_007]: {
		getChanges: (params) => [
			{ resource: `Guest: ${targetName(params)}`, field: 'userAccount', currentValue: 'exists', proposedValue: 'deleted' },
		],
		estimatedDuration: '5-10 seconds',
		reversible: false,
	},
	[REMEDIATION_ACTION_IDS.REM_008]: {
		getChanges: () => [
			{ resource: 'Authorization Policy', field: 'allowInvitesFrom', currentValue: 'everyone', proposedValue: 'adminsAndGuestInviters' },
			{ resource: 'Authorization Policy', field: 'guestUserRoleId', currentValue: 'default', proposedValue: 'restricted' },
		],
		estimatedDuration: '5-10 seconds',
		reversible: true,
	},
	[REMEDIATION_ACTION_IDS.REM_009]: {
		getChanges: (params) => [
			{ resource: `CA Policy: ${params.displayName ?? params.targetId ?? 'unknown'}`, field: 'state', currentValue: 'disabled', proposedValue: 'enabled' },
		],
		estimatedDuration: '5-10 seconds',
		reversible: true,
	},
};

/**
 * Returns a preview of what a remediation action WOULD change, without executing it.
 */
export async function getDryRunResult(
	actionType: string,
	params: Record<string, unknown>
): Promise<DryRunPreview> {
	const config = ACTION_PREVIEWS[actionType as ActionType];

	if (!config) {
		return {
			changes: [],
			estimatedDuration: 'unknown',
			reversible: false,
			affectedResources: 0,
		};
	}

	const changes = config.getChanges(params);

	return {
		changes,
		estimatedDuration: config.estimatedDuration,
		reversible: config.reversible,
		affectedResources: changes.length,
	};
}
