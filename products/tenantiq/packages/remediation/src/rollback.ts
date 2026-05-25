import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';
import {
	rollbackDecommission,
	rollbackBlockIp,
	rollbackDowngradeLicense,
	rollbackRestrictSharing,
	rollbackEnableConditionalAccess,
	rollbackRemoveGuest
} from './rollback-actions';

/**
 * Rollback engine.
 * Creates and executes rollback plans from remediation state snapshots.
 */

export interface RollbackAction {
	actionType: string;
	beforeState: Record<string, unknown>;
	afterState: Record<string, unknown>;
	rollback(graphClient: GraphClient, tenantId: string): Promise<{ success: boolean; message: string }>;
}

/** Actions that are inherently irreversible. */
const IRREVERSIBLE_ACTIONS: Set<string> = new Set([
	REMEDIATION_ACTION_IDS.REM_002, // Enable MFA — security risk to disable
	REMEDIATION_ACTION_IDS.REM_005, // Revoke sessions — sessions are ephemeral
	REMEDIATION_ACTION_IDS.REM_006  // Force password reset — can't restore old password
]);

/** Human-readable reason why an action cannot be rolled back. */
const IRREVERSIBLE_REASONS: Record<string, string> = {
	[REMEDIATION_ACTION_IDS.REM_002]: 'Disabling MFA is a security risk. Manage policies manually.',
	[REMEDIATION_ACTION_IDS.REM_005]: 'Session revocation cannot be undone. Sessions are ephemeral.',
	[REMEDIATION_ACTION_IDS.REM_006]: 'Password reset cannot be undone. The old password is not recoverable.'
};

/**
 * Check whether a remediation action type supports rollback.
 */
export function isRollbackSupported(actionType: string): boolean {
	return !IRREVERSIBLE_ACTIONS.has(actionType);
}

/**
 * Get the reason an action cannot be rolled back, or null if rollback is supported.
 */
export function getIrreversibleReason(actionType: string): string | null {
	return IRREVERSIBLE_REASONS[actionType] ?? null;
}

/**
 * Create a rollback plan for a completed remediation action.
 * Returns a RollbackAction that can be executed to reverse the remediation.
 * Throws if the action type is irreversible.
 */
export function createRollbackPlan(
	actionType: string,
	beforeState: Record<string, unknown>,
	afterState: Record<string, unknown>,
	tenantId: string
): RollbackAction {
	if (IRREVERSIBLE_ACTIONS.has(actionType)) {
		const reason = IRREVERSIBLE_REASONS[actionType] ?? 'This action cannot be rolled back.';
		throw new RollbackNotSupportedError(actionType, reason);
	}

	const handler = ACTION_ROLLBACK_HANDLERS[actionType];
	if (!handler) {
		throw new RollbackNotSupportedError(actionType, `Unknown action type: ${actionType}`);
	}

	return {
		actionType,
		beforeState,
		afterState,
		async rollback(graphClient: GraphClient) {
			return handler(tenantId, beforeState, afterState, graphClient);
		}
	};
}

/**
 * Execute a rollback directly (convenience wrapper around createRollbackPlan).
 */
export async function executeRollback(
	tenantId: string,
	actionId: string,
	beforeState: unknown,
	graphClient: GraphClient,
	afterState?: unknown
): Promise<{ success: boolean; error?: string }> {
	try {
		const plan = createRollbackPlan(
			actionId,
			(beforeState as Record<string, unknown>) ?? {},
			(afterState as Record<string, unknown>) ?? {},
			tenantId
		);
		const result = await plan.rollback(graphClient, tenantId);
		return { success: result.success, error: result.success ? undefined : result.message };
	} catch (err) {
		if (err instanceof RollbackNotSupportedError) {
			return { success: false, error: err.message };
		}
		return { success: false, error: `Rollback failed: ${err}` };
	}
}

export class RollbackNotSupportedError extends Error {
	constructor(
		public readonly actionType: string,
		reason: string
	) {
		super(reason);
		this.name = 'RollbackNotSupportedError';
	}
}

type RollbackHandler = (
	tenantId: string,
	beforeState: Record<string, unknown>,
	afterState: Record<string, unknown>,
	graphClient: GraphClient
) => Promise<{ success: boolean; message: string }>;

/** Maps action IDs to their rollback handler functions. */
const ACTION_ROLLBACK_HANDLERS: Record<string, RollbackHandler> = {
	[REMEDIATION_ACTION_IDS.REM_001]: rollbackDecommission,
	[REMEDIATION_ACTION_IDS.REM_003]: rollbackBlockIp,
	[REMEDIATION_ACTION_IDS.REM_004]: rollbackDowngradeLicense,
	[REMEDIATION_ACTION_IDS.REM_007]: rollbackRemoveGuest,
	[REMEDIATION_ACTION_IDS.REM_008]: rollbackRestrictSharing,
	[REMEDIATION_ACTION_IDS.REM_009]: rollbackEnableConditionalAccess
};
