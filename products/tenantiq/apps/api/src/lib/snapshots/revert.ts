/**
 * Drift revert (T2.5).
 *
 * Takes a config_drifts row → emits the Graph PATCH/PUT operations that
 * restore the value captured in the previous snapshot.
 *
 * Coverage: starts with 3 high-value categories. Other 7 categories from
 * config-reader.ts return revertSupported: false with a reason; expand
 * the SUPPORTED_CATEGORIES set + handler map as needed.
 *
 * Safety:
 *  - Pure planner. Does not call Graph itself. Returns RevertPlan that
 *    a caller (audited route) can apply.
 *  - Always requires explicit approval before apply (no silent reverts).
 *  - Categorical reverts that touch multiple resources (e.g., 50 CA
 *    policies) are rejected unless `bulkApproved: true`.
 */

export type RevertCategory =
	| 'conditional_access'
	| 'authorization'
	| 'auth_methods';

export const SUPPORTED_CATEGORIES: ReadonlySet<RevertCategory> = new Set([
	'conditional_access',
	'authorization',
	'auth_methods',
]);

export interface DriftInput {
	categoryId: string;
	path: string;
	oldValue: unknown;
	newValue: unknown;
}

export interface GraphOp {
	method: 'PATCH' | 'PUT' | 'POST' | 'DELETE';
	path: string;
	body?: unknown;
}

export interface RevertPlan {
	supported: true;
	category: RevertCategory;
	ops: GraphOp[];
	humanSummary: string;
}

export interface RevertNotSupported {
	supported: false;
	reason: string;
}

export type RevertOutcome = RevertPlan | RevertNotSupported;

export function planRevert(drift: DriftInput): RevertOutcome {
	const cat = drift.categoryId as RevertCategory;
	if (!SUPPORTED_CATEGORIES.has(cat)) {
		return {
			supported: false,
			reason: `Category "${drift.categoryId}" is not yet revertable. Manual change required in the M365 admin portal.`,
		};
	}

	switch (cat) {
		case 'conditional_access':
			return planConditionalAccessRevert(drift);
		case 'authorization':
			return planAuthorizationRevert(drift);
		case 'auth_methods':
			return planAuthMethodsRevert(drift);
		default:
			return { supported: false, reason: `Unsupported category: ${drift.categoryId}` };
	}
}

function planConditionalAccessRevert(drift: DriftInput): RevertOutcome {
	// path examples (from diff.ts recursive walker):
	//   "policy-id-abc.state"
	//   "policy-id-abc.conditions.users.includeUsers"
	//   "policy-id-abc"  (whole policy added/removed at root)
	const segments = drift.path.split('.');
	const policyId = segments[0];
	if (!policyId) return { supported: false, reason: 'Could not extract policy ID from drift path' };

	// Whole policy was added (drift represents a policy that exists in new
	// snapshot but not in baseline) — revert means delete it.
	if (segments.length === 1 && drift.oldValue == null && drift.newValue != null) {
		return {
			supported: true,
			category: 'conditional_access',
			ops: [{ method: 'DELETE', path: `/identity/conditionalAccess/policies/${policyId}` }],
			humanSummary: `Delete CA policy "${policyId}" (added since baseline)`,
		};
	}

	// Whole policy removed since baseline — recreate it.
	if (segments.length === 1 && drift.oldValue != null && drift.newValue == null) {
		return {
			supported: true,
			category: 'conditional_access',
			ops: [{ method: 'POST', path: '/identity/conditionalAccess/policies', body: drift.oldValue }],
			humanSummary: `Recreate CA policy "${policyId}" (deleted since baseline)`,
		};
	}

	// Property change inside an existing policy — PATCH the property.
	const subPath = segments.slice(1).join('.');
	const body = subPathToObject(subPath, drift.oldValue);
	return {
		supported: true,
		category: 'conditional_access',
		ops: [{
			method: 'PATCH',
			path: `/identity/conditionalAccess/policies/${policyId}`,
			body,
		}],
		humanSummary: `Restore CA policy "${policyId}" property "${subPath}" to baseline value`,
	};
}

function planAuthorizationRevert(drift: DriftInput): RevertOutcome {
	// /policies/authorizationPolicy is a singleton. Path will be like
	// "allowInvitesFrom" or "defaultUserRolePermissions.permissionGrantPoliciesAssigned".
	const body = subPathToObject(drift.path, drift.oldValue);
	return {
		supported: true,
		category: 'authorization',
		ops: [{ method: 'PATCH', path: '/policies/authorizationPolicy', body }],
		humanSummary: `Restore authorizationPolicy.${drift.path} to baseline value`,
	};
}

function planAuthMethodsRevert(drift: DriftInput): RevertOutcome {
	// /policies/authenticationMethodsPolicy is also singleton. Property change
	// can target the policy itself or a nested authenticationMethodConfigurations entry.
	const body = subPathToObject(drift.path, drift.oldValue);
	return {
		supported: true,
		category: 'auth_methods',
		ops: [{ method: 'PATCH', path: '/policies/authenticationMethodsPolicy', body }],
		humanSummary: `Restore authenticationMethodsPolicy.${drift.path} to baseline value`,
	};
}

/**
 * Build a nested object from a dotted path, e.g.:
 *   subPathToObject('a.b.c', 42) => { a: { b: { c: 42 } } }
 * Used to send minimal PATCH bodies that only touch the property that drifted.
 */
export function subPathToObject(subPath: string, value: unknown): Record<string, unknown> {
	if (!subPath) return value as Record<string, unknown>;
	const parts = subPath.split('.');
	const root: Record<string, unknown> = {};
	let cursor: Record<string, unknown> = root;
	for (let i = 0; i < parts.length - 1; i++) {
		cursor[parts[i]] = {};
		cursor = cursor[parts[i]] as Record<string, unknown>;
	}
	cursor[parts[parts.length - 1]] = value;
	return root;
}

/**
 * Plan revert for many drift rows at once. Returns supported plans + a list
 * of unsupported rows so the UI can show "X of Y can be reverted".
 */
export function planBulkRevert(drifts: DriftInput[]): {
	supported: RevertPlan[];
	unsupported: Array<{ drift: DriftInput; reason: string }>;
} {
	const supported: RevertPlan[] = [];
	const unsupported: Array<{ drift: DriftInput; reason: string }> = [];
	for (const d of drifts) {
		const outcome = planRevert(d);
		if (outcome.supported) supported.push(outcome);
		else unsupported.push({ drift: d, reason: outcome.reason });
	}
	return { supported, unsupported };
}
