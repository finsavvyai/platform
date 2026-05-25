import type { GraphClient } from '@tenantiq/graph';

/**
 * Per-action rollback implementations.
 * Each function reverses the effect of a remediation action using captured state.
 */

type RollbackResult = { success: boolean; message: string };
type State = Record<string, unknown>;

/** REM-001: Re-enable account and re-assign original licenses. */
export async function rollbackDecommission(
	tenantId: string,
	beforeState: State,
	_afterState: State,
	graphClient: GraphClient
): Promise<RollbackResult> {
	const users = beforeState.users as Array<{
		userId: string;
		accountEnabled: boolean;
		assignedLicenses?: Array<{ skuId: string; disabledPlans: string[] }>;
	}>;

	if (!users?.length) {
		return { success: false, message: 'No user state available for rollback' };
	}

	for (const user of users) {
		await graphClient.request(tenantId, `/users/${user.userId}`, {
			method: 'PATCH',
			body: JSON.stringify({ accountEnabled: true })
		});

		if (user.assignedLicenses?.length) {
			await graphClient.request(tenantId, `/users/${user.userId}/assignLicense`, {
				method: 'POST',
				body: JSON.stringify({ addLicenses: user.assignedLicenses, removeLicenses: [] })
			});
		}
	}

	return { success: true, message: `Re-enabled ${users.length} user(s) and restored licenses` };
}

/** REM-003: Remove the blocking policy and named location created by block-ip. */
export async function rollbackBlockIp(
	tenantId: string,
	_beforeState: State,
	afterState: State,
	graphClient: GraphClient
): Promise<RollbackResult> {
	const policyId = (afterState.policy as { id?: string })?.id;
	const locationId = afterState.locationId as string | undefined;

	if (!policyId && !locationId) {
		return { success: false, message: 'No policy or location IDs in afterState for rollback' };
	}

	if (policyId) {
		await graphClient.request(tenantId, `/identity/conditionalAccessPolicies/${policyId}`, {
			method: 'DELETE'
		});
	}

	if (locationId) {
		await graphClient.request(
			tenantId,
			`/identity/conditionalAccess/namedLocations/${locationId}`,
			{ method: 'DELETE' }
		);
	}

	return { success: true, message: 'Removed blocking policy and named location' };
}

/** REM-004: Swap back to original license SKU. */
export async function rollbackDowngradeLicense(
	tenantId: string,
	beforeState: State,
	_afterState: State,
	graphClient: GraphClient
): Promise<RollbackResult> {
	const users = beforeState.users as Array<{
		userId: string;
		licenses: Array<{ skuId: string }>;
	}>;

	if (!users?.length) {
		return { success: false, message: 'No license state available for rollback' };
	}

	for (const user of users) {
		const current = await graphClient.request<{
			assignedLicenses: Array<{ skuId: string }>;
		}>(tenantId, `/users/${user.userId}?$select=assignedLicenses`);

		const currentSkuIds = current.assignedLicenses.map((l) => l.skuId);
		const originalSkuIds = user.licenses.map((l) => l.skuId);
		const toRemove = currentSkuIds.filter((id) => !originalSkuIds.includes(id));
		const toAdd = originalSkuIds.filter((id) => !currentSkuIds.includes(id));

		if (toAdd.length > 0 || toRemove.length > 0) {
			await graphClient.request(tenantId, `/users/${user.userId}/assignLicense`, {
				method: 'POST',
				body: JSON.stringify({
					addLicenses: toAdd.map((skuId) => ({ skuId, disabledPlans: [] })),
					removeLicenses: toRemove
				})
			});
		}
	}

	return { success: true, message: `Restored licenses for ${users.length} user(s)` };
}

/** REM-008: Restore original sharing/invitation policy settings. */
export async function rollbackRestrictSharing(
	tenantId: string,
	beforeState: State,
	_afterState: State,
	graphClient: GraphClient
): Promise<RollbackResult> {
	const allowInvitesFrom = beforeState.allowInvitesFrom as string | undefined;
	const guestUserRoleId = beforeState.guestUserRoleId as string | undefined;

	if (!allowInvitesFrom && !guestUserRoleId) {
		return { success: false, message: 'No sharing policy state available for rollback' };
	}

	await graphClient.request(tenantId, '/policies/authorizationPolicy', {
		method: 'PATCH',
		body: JSON.stringify({ allowInvitesFrom, guestUserRoleId })
	});

	return { success: true, message: 'Restored original sharing policy settings' };
}

/** REM-009: Restore conditional access policies to their original state. */
export async function rollbackEnableConditionalAccess(
	tenantId: string,
	beforeState: State,
	_afterState: State,
	graphClient: GraphClient
): Promise<RollbackResult> {
	const policies = beforeState.policies as Array<{ id: string; state: string }> | undefined;

	if (!policies?.length) {
		return { success: false, message: 'No policy state available for rollback' };
	}

	for (const policy of policies) {
		await graphClient.request(
			tenantId,
			`/identity/conditionalAccessPolicies/${policy.id}`,
			{ method: 'PATCH', body: JSON.stringify({ state: policy.state }) }
		);
	}

	return { success: true, message: `Restored ${policies.length} policy(ies) to original state` };
}

/** REM-007: Re-invite deleted guest user. */
export async function rollbackRemoveGuest(
	tenantId: string,
	beforeState: State,
	_afterState: State,
	graphClient: GraphClient
): Promise<RollbackResult> {
	const guests = beforeState.guests as Array<{
		displayName?: string;
		mail?: string;
	}> | undefined;

	if (!guests?.length) {
		return { success: false, message: 'No guest info available for re-invitation' };
	}

	for (const guest of guests) {
		if (!guest.mail) continue;
		await graphClient.request(tenantId, '/invitations', {
			method: 'POST',
			body: JSON.stringify({
				invitedUserEmailAddress: guest.mail,
				invitedUserDisplayName: guest.displayName ?? '',
				sendInvitationMessage: true,
				inviteRedirectUrl: 'https://myapps.microsoft.com'
			})
		});
	}

	return { success: true, message: `Re-invited ${guests.length} guest(s)` };
}
