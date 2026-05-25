import { GraphClient } from './client';

export class LicenseOperations {
	constructor(private client: GraphClient) {}

	/**
	 * Get all subscribed SKUs (license summary).
	 */
	async getSubscribedSkus(tenantId: string) {
		return this.client.request<{ value: unknown[] }>(tenantId, '/subscribedSkus');
	}

	/**
	 * Assign a license to a user.
	 */
	async assignLicense(tenantId: string, userId: string, addLicenses: Array<{ skuId: string }>, removeLicenses: string[] = []) {
		return this.client.request(tenantId, `/users/${userId}/assignLicense`, {
			method: 'POST',
			body: JSON.stringify({
				addLicenses: addLicenses.map((l) => ({ skuId: l.skuId, disabledPlans: [] })),
				removeLicenses
			})
		});
	}

	/**
	 * Remove all licenses from a user.
	 */
	async removeAllLicenses(tenantId: string, userId: string, skuIds: string[]) {
		return this.client.request(tenantId, `/users/${userId}/assignLicense`, {
			method: 'POST',
			body: JSON.stringify({
				addLicenses: [],
				removeLicenses: skuIds
			})
		});
	}
}
