import { GraphClient } from './client';

export class ReportOperations {
	constructor(private client: GraphClient) {}

	/**
	 * Get M365 app usage per user (Teams, Exchange, SharePoint, OneDrive).
	 */
	async getAppUserDetail(tenantId: string, period = 'D30') {
		return this.client.request<{ value: unknown[] }>(
			tenantId,
			`/reports/getM365AppUserDetail(period='${period}')?$format=application/json`
		);
	}

	/**
	 * Get mailbox usage detail.
	 */
	async getMailboxUsageDetail(tenantId: string, period = 'D30') {
		return this.client.request<{ value: unknown[] }>(
			tenantId,
			`/reports/getMailboxUsageDetail(period='${period}')?$format=application/json`
		);
	}

	/**
	 * Get service health overview.
	 */
	async getServiceHealth(tenantId: string) {
		return this.client.request<{ value: unknown[] }>(
			tenantId,
			'/admin/serviceAnnouncement/healthOverviews'
		);
	}
}
