/**
 * GraphClient Extension Methods for Security Stack Monitoring
 *
 * Add these methods to packages/graph/src/GraphClient.ts to support drift monitoring.
 * Each method fetches a specific security configuration from Microsoft Graph API.
 */

// Add to GraphClient class:

async listConditionalAccessPolicies() {
	const response = await this.client.api('/identity/conditionalAccess/policies').get();
	return response;
}

async listDLPPolicies() {
	const response = await this.client
		.api('/security/informationProtection/dataLossPreventionPolicies')
		.get();
	return response;
}

async listLabels() {
	const response = await this.client
		.api('/security/informationProtection/labels')
		.get();
	return response;
}

async getRiskDetectionPolicies() {
	try {
		const signInRisk = await this.client
			.api('/identity/signInRisks')
			.get();
		return { signInRiskPolicy: !!signInRisk?.value?.length };
	} catch (error) {
		console.error('Failed to fetch sign-in risk policy', error);
		return { signInRiskPolicy: false };
	}
}

async listRiskyUsers() {
	try {
		const response = await this.client
			.api('/identity/riskyUsers')
			.get();
		return response;
	} catch (error) {
		console.error('Failed to fetch risky users', error);
		return { value: [] };
	}
}

async getMFACoverage() {
	try {
		const users = await this.client
			.api('/users')
			.filter("accountEnabled eq true")
			.select('id')
			.get();

		const mfaUsers = await this.client
			.api('/me/authentication/methods')
			.get();

		const coverage = users?.value?.length
			? Math.round((mfaUsers?.value?.length / users.value.length) * 100)
			: 0;

		return { coverage };
	} catch (error) {
		console.error('Failed to fetch MFA coverage', error);
		return { coverage: 0 };
	}
}

async getEmailSecuritySettings() {
	try {
		// Fetch ATP settings from Security & Compliance
		const response = await this.client
			.api('/security/threatIntelligence/emailThreatProtection')
			.get();

		return {
			safeLinksEnabled: response?.safeLinksPolicies?.length > 0,
			safeAttachmentsEnabled: response?.safeAttachmentsPolicies?.length > 0,
			antiPhishingEnabled: response?.antiPhishingPolicies?.length > 0,
		};
	} catch (error) {
		console.error('Failed to fetch email security settings', error);
		return {
			safeLinksEnabled: false,
			safeAttachmentsEnabled: false,
			antiPhishingEnabled: false,
		};
	}
}

// Alternative implementation using PowerShell Graph API if above Graph endpoints are unavailable:

async getEmailSecuritySettingsViaExchange() {
	try {
		// Query Exchange Online for ATP policies
		const policies = await this.client
			.api('/me/mailboxes/inbox/rules')
			.get();

		// Parse policy names to determine ATP status
		const policyNames = policies?.value?.map((p: any) => p.displayName) || [];

		return {
			safeLinksEnabled: policyNames.some((n: string) => n.includes('Safe Links')),
			safeAttachmentsEnabled: policyNames.some((n: string) => n.includes('Safe Attachments')),
			antiPhishingEnabled: policyNames.some((n: string) => n.includes('Anti-phishing')),
		};
	} catch (error) {
		console.error('Failed to fetch Exchange settings', error);
		return {
			safeLinksEnabled: false,
			safeAttachmentsEnabled: false,
			antiPhishingEnabled: false,
		};
	}
}

/**
 * IMPORTANT: Graph API Permissions Required
 *
 * Request these permissions in your app registration (apps/api/wrangler.toml):
 *
 * - Policy.Read.All              (Conditional Access policies)
 * - DLPEvaluate.All             (Data Loss Prevention)
 * - InformationProtectionPolicy.Read.All (Labels)
 * - User.ReadWrite.All          (User list for MFA coverage)
 * - IdentityRiskyUser.ReadWrite.All (Risky users)
 * - SecurityEvents.ReadWrite.All (Email security)
 * - SecuritySettings.Read.All    (General security settings)
 *
 * Add to your Microsoft Entra app manifest if using certificate auth.
 */

/**
 * TESTING MOCK
 *
 * Use this mock for unit tests:
 */

export const mockGraphClient = {
	listConditionalAccessPolicies: async () => ({
		value: [
			{
				id: 'policy1',
				displayName: 'Require MFA',
				grantControls: { builtInControls: ['mfa'] },
			},
		],
	}),

	listDLPPolicies: async () => ({
		value: [
			{ id: 'dlp1', displayName: 'Protect Credit Cards' },
		],
	}),

	listLabels: async () => ({
		value: [
			{ id: 'label1', displayName: 'Confidential' },
		],
	}),

	getRiskDetectionPolicies: async () => ({ signInRiskPolicy: true }),

	listRiskyUsers: async () => ({ value: [] }),

	getMFACoverage: async () => ({ coverage: 95 }),

	getEmailSecuritySettings: async () => ({
		safeLinksEnabled: true,
		safeAttachmentsEnabled: true,
		antiPhishingEnabled: true,
	}),
};
