import type { GraphClient } from '@tenantiq/graph';
import { REMEDIATION_ACTION_IDS } from '@tenantiq/shared';

export interface RemediationAction {
	id: string;
	name: string;
	description: string;
	reversible: boolean;
	execute(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult>;
	dryRun(tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<DryRunResult>;
}

export interface RemediationResult {
	success: boolean;
	beforeState: unknown;
	afterState: unknown;
	error?: string;
}

export interface DryRunResult {
	changes: Array<{
		resource: string;
		action: string;
		currentState: unknown;
		newState: unknown;
	}>;
}

/**
 * Remediation executor framework.
 * Manages execution of remediation actions with before/after state capture.
 */
export class RemediationExecutor {
	private actions: Map<string, RemediationAction> = new Map();

	register(action: RemediationAction) {
		this.actions.set(action.id, action);
	}

	getAction(actionId: string): RemediationAction | undefined {
		return this.actions.get(actionId);
	}

	listActions(): Omit<RemediationAction, 'execute' | 'dryRun'>[] {
		return Array.from(this.actions.values()).map(({ execute, dryRun, ...rest }) => rest);
	}

	async execute(actionId: string, tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<RemediationResult> {
		const action = this.actions.get(actionId);
		if (!action) {
			return { success: false, beforeState: null, afterState: null, error: `Unknown action: ${actionId}` };
		}

		return action.execute(tenantId, resources, graphClient);
	}

	async dryRun(actionId: string, tenantId: string, resources: unknown[], graphClient: GraphClient): Promise<DryRunResult> {
		const action = this.actions.get(actionId);
		if (!action) {
			return { changes: [] };
		}

		return action.dryRun(tenantId, resources, graphClient);
	}
}
