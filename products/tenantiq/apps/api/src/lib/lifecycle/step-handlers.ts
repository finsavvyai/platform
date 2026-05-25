/**
 * Lifecycle Step Handlers — individual Graph API actions for onboarding/offboarding.
 */

export interface StepResult {
	step: string;
	status: 'success' | 'failed' | 'skipped';
	detail: string;
}

type GraphFetch = (path: string, init?: RequestInit) => Promise<any>;

export async function disableAccount(graphFetch: GraphFetch, userId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ accountEnabled: false }) });
		return { step: 'disable_account', status: 'success', detail: `Disabled account ${userId}` };
	} catch (err) {
		return { step: 'disable_account', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function revokeSessionas(graphFetch: GraphFetch, userId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}/revokeSignInSessions`, { method: 'POST' });
		return { step: 'revoke_sessions', status: 'success', detail: `Revoked all sessions for ${userId}` };
	} catch (err) {
		return { step: 'revoke_sessions', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function removeLicense(graphFetch: GraphFetch, userId: string, skuId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}/assignLicense`, { method: 'POST', body: JSON.stringify({ addLicenses: [], removeLicenses: [skuId] }) });
		return { step: 'remove_license', status: 'success', detail: `Removed license ${skuId}` };
	} catch (err) {
		return { step: 'remove_license', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function assignLicense(graphFetch: GraphFetch, userId: string, skuId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}/assignLicense`, { method: 'POST', body: JSON.stringify({ addLicenses: [{ skuId }], removeLicenses: [] }) });
		return { step: 'assign_license', status: 'success', detail: `Assigned license ${skuId}` };
	} catch (err) {
		return { step: 'assign_license', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function addToGroup(graphFetch: GraphFetch, userId: string, groupId: string): Promise<StepResult> {
	try {
		await graphFetch(`/groups/${groupId}/members/$ref`, { method: 'POST', body: JSON.stringify({ '@odata.id': `https://graph.microsoft.com/v1.0/users/${userId}` }) });
		return { step: 'add_to_group', status: 'success', detail: `Added to group ${groupId}` };
	} catch (err) {
		return { step: 'add_to_group', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function removeFromGroup(graphFetch: GraphFetch, userId: string, groupId: string): Promise<StepResult> {
	try {
		await graphFetch(`/groups/${groupId}/members/${userId}/$ref`, { method: 'DELETE' });
		return { step: 'remove_from_group', status: 'success', detail: `Removed from group ${groupId}` };
	} catch (err) {
		return { step: 'remove_from_group', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function forcePasswordChange(graphFetch: GraphFetch, userId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ passwordProfile: { forceChangePasswordNextSignIn: true } }) });
		return { step: 'force_password_change', status: 'success', detail: 'Password change required on next sign-in' };
	} catch (err) {
		return { step: 'force_password_change', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function enableAccount(graphFetch: GraphFetch, userId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ accountEnabled: true }) });
		return { step: 'enable_account', status: 'success', detail: `Enabled account ${userId}` };
	} catch (err) { return { step: 'enable_account', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' }; }
}

export async function resetPassword(graphFetch: GraphFetch, userId: string): Promise<StepResult> {
	try {
		const temp = `TIQ${crypto.randomUUID().slice(0, 8)}!`;
		await graphFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ passwordProfile: { password: temp, forceChangePasswordNextSignIn: true } }) });
		return { step: 'reset_password', status: 'success', detail: 'Password reset — user must change on next sign-in' };
	} catch (err) { return { step: 'reset_password', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' }; }
}

export async function blockSignIn(graphFetch: GraphFetch, userId: string): Promise<StepResult> {
	try {
		await graphFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ accountEnabled: false }) });
		await graphFetch(`/users/${userId}/revokeSignInSessions`, { method: 'POST' });
		return { step: 'block_signin', status: 'success', detail: 'Account disabled and all sessions revoked' };
	} catch (err) { return { step: 'block_signin', status: 'failed', detail: err instanceof Error ? err.message : 'Failed' }; }
}

export const STEP_REGISTRY: Record<string, (gf: GraphFetch, userId: string, param?: string) => Promise<StepResult>> = {
	disable_account: (gf, uid) => disableAccount(gf, uid),
	enable_account: (gf, uid) => enableAccount(gf, uid),
	revoke_sessions: (gf, uid) => revokeSessionas(gf, uid),
	remove_license: (gf, uid, p) => removeLicense(gf, uid, p || ''),
	assign_license: (gf, uid, p) => assignLicense(gf, uid, p || ''),
	add_to_group: (gf, uid, p) => addToGroup(gf, uid, p || ''),
	remove_from_group: (gf, uid, p) => removeFromGroup(gf, uid, p || ''),
	force_password_change: (gf, uid) => forcePasswordChange(gf, uid),
	reset_password: (gf, uid) => resetPassword(gf, uid),
	block_signin: (gf, uid) => blockSignIn(gf, uid),
};
