/**
 * TenantIQ API Client for OpenClaw Skill
 *
 * Composed from:
 *  - BaseHttpClient (http-client.ts) — auth, token refresh, config
 *  - AiOperationsClient (ai-operations.ts) — AI scan, ask, chain, status
 *  - TenantIQClient (this file) — tenant, security, alert, license, user ops
 */

export { BaseHttpClient } from './http-client';
export { AiOperationsClient } from './ai-operations';

import { AiOperationsClient } from './ai-operations';
import type {
	TenantIQApiClient,
	SecurityStatus,
	Alert,
	AlertFilters,
	LicenseWaste,
	User,
	Tenant,
	Dashboard,
	RemediationResult
} from '../types';

export class TenantIQClient extends AiOperationsClient implements TenantIQApiClient {
	/**
	 * Get security status for active tenant
	 */
	async getSecurityStatus(tenantId: string): Promise<SecurityStatus> {
		const response = await this.request<{ security: SecurityStatus }>(
			`/tenants/${tenantId}/dashboard`
		);

		return {
			secureScore: response.security.secureScore || 0,
			alertCounts: response.security.alertCounts || { critical: 0, high: 0, medium: 0, low: 0 },
			mfaAdoption: response.security.mfaAdoption || 0,
			riskyUsers: response.security.riskyUsers || 0
		};
	}

	/**
	 * List alerts with optional filters
	 */
	async listAlerts(tenantId: string, filters?: AlertFilters): Promise<Alert[]> {
		const params = new URLSearchParams();

		if (filters?.severity) params.append('severity', filters.severity);
		if (filters?.category) params.append('category', filters.category);
		if (filters?.status) params.append('status', filters.status || 'active');

		const queryString = params.toString();
		const endpoint = `/alerts${queryString ? `?${queryString}` : ''}`;

		const response = await this.request<{ alerts: Alert[] }>(endpoint);
		return response.alerts;
	}

	/**
	 * Get license waste analysis
	 */
	async getLicenseWaste(tenantId: string): Promise<LicenseWaste> {
		const response = await this.request<{ waste: LicenseWaste }>(
			`/licenses/waste?tenantId=${tenantId}`
		);
		return response.waste;
	}

	/**
	 * Search users
	 */
	async searchUsers(tenantId: string, query: string): Promise<User[]> {
		const response = await this.request<{ users: User[] }>(
			`/users?search=${encodeURIComponent(query)}`
		);
		return response.users;
	}

	/**
	 * Get tenant dashboard metrics
	 */
	async getDashboard(tenantId: string): Promise<Dashboard> {
		const response = await this.request<Dashboard>(
			`/tenants/${tenantId}/dashboard`
		);
		return response;
	}

	/**
	 * List all accessible tenants
	 */
	async listTenants(): Promise<Tenant[]> {
		const response = await this.request<{ tenants: Tenant[] }>('/tenants');
		return response.tenants;
	}

	/**
	 * Execute remediation action
	 */
	async executeRemediation(
		tenantId: string,
		actionId: string,
		params: Record<string, unknown>
	): Promise<RemediationResult> {
		const response = await this.request<RemediationResult>(
			`/remediation/execute`,
			{
				method: 'POST',
				body: JSON.stringify({
					actionId,
					...params
				})
			}
		);
		return response;
	}
}
