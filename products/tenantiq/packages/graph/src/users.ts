import { GraphClient } from './client';

export class UserOperations {
	constructor(private client: GraphClient) {}

	/**
	 * Fetch all users with sign-in activity data.
	 */
	async listWithSignInActivity(tenantId: string) {
		const users: unknown[] = [];
		const path = '/users?$select=id,displayName,mail,userPrincipalName,userType,accountEnabled,signInActivity,assignedLicenses&$top=999';

		for await (const batch of this.client.paginate<unknown>(tenantId, path)) {
			users.push(...batch);
		}

		return users;
	}

	/**
	 * Disable a user account.
	 */
	async disableUser(tenantId: string, userId: string) {
		return this.client.request(tenantId, `/users/${userId}`, {
			method: 'PATCH',
			body: JSON.stringify({ accountEnabled: false })
		});
	}

	/**
	 * Revoke all sign-in sessions for a user.
	 */
	async revokeSignInSessions(tenantId: string, userId: string) {
		return this.client.request(tenantId, `/users/${userId}/revokeSignInSessions`, {
			method: 'POST'
		});
	}

	/**
	 * Force a user to change their password at next sign-in.
	 */
	async forcePasswordChange(tenantId: string, userId: string) {
		return this.client.request(tenantId, `/users/${userId}`, {
			method: 'PATCH',
			body: JSON.stringify({
				passwordProfile: { forceChangePasswordNextSignIn: true }
			})
		});
	}

	/**
	 * Delete a guest user.
	 */
	async deleteUser(tenantId: string, userId: string) {
		return this.client.request(tenantId, `/users/${userId}`, {
			method: 'DELETE'
		});
	}
}
