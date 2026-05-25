import { GraphClient } from './client';

export class SecurityOperations {
	constructor(private client: GraphClient) {}

	/**
	 * Get risky users from Identity Protection.
	 */
	async getRiskyUsers(tenantId: string) {
		return this.client.request<{ value: unknown[] }>(tenantId, '/identityProtection/riskyUsers?$filter=riskState eq \'atRisk\'');
	}

	/**
	 * Get recent sign-in logs.
	 */
	async getSignInLogs(tenantId: string, hours = 24) {
		const since = new Date(Date.now() - hours * 3600000).toISOString();
		return this.client.request<{ value: unknown[] }>(
			tenantId,
			`/auditLogs/signIns?$filter=createdDateTime ge ${since}&$top=999&$orderby=createdDateTime desc`
		);
	}

	/**
	 * Get failed sign-in attempts.
	 */
	async getFailedSignIns(tenantId: string, hours = 24) {
		const since = new Date(Date.now() - hours * 3600000).toISOString();
		return this.client.request<{ value: unknown[] }>(
			tenantId,
			`/auditLogs/signIns?$filter=createdDateTime ge ${since} and status/errorCode ne 0&$top=999`
		);
	}

	/**
	 * Get Secure Score.
	 */
	async getSecureScore(tenantId: string) {
		return this.client.request<{ value: unknown[] }>(tenantId, '/security/secureScores?$top=1');
	}

	/**
	 * Get user authentication methods (for MFA check).
	 */
	async getUserAuthMethods(tenantId: string, userId: string) {
		return this.client.request<{ value: unknown[] }>(
			tenantId,
			`/users/${userId}/authentication/methods`
		);
	}
}
