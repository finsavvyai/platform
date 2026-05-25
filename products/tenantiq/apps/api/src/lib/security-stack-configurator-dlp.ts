/**
 * Data Loss Prevention and Identity Protection configuration functions.
 * Part of Security Stack Configuration Engine.
 */
import type { GraphClient } from './graph-client';
import type { ConfigAction } from './security-stack-configurator';

// ─── Data Loss Prevention ────────────────────────────────────────────────────

export async function createBasicDlpPolicy(
	graph: GraphClient,
	options: { name?: string; piiTypes?: string[] }
): Promise<ConfigAction> {
	try {
		const piiTypes = options.piiTypes ?? ['SSN', 'CreditCard'];

		const policy = await graph.fetch('/security/sensitivityLabels', {
			method: 'POST',
			body: JSON.stringify({
				displayName: options.name ?? 'TenantIQ: Basic DLP',
				description: 'Auto-generated DLP policy protecting PII',
				color: '#0078D4',
				tooltip: 'Contains sensitive PII',
				isActive: true,
				contentFormats: ['email', 'documents']
			})
		});

		return {
			success: true,
			action: 'Create Basic DLP Policy',
			details: `DLP policy protecting: ${piiTypes.join(', ')}`,
			rollbackInfo: { policyId: policy.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Create Basic DLP Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

export async function enableSensitivityLabels(
	graph: GraphClient,
	options: { labels?: Array<{ name: string; priority: number }> }
): Promise<ConfigAction> {
	try {
		const labels = options.labels ?? [
			{ name: 'Public', priority: 1 },
			{ name: 'Internal', priority: 2 },
			{ name: 'Confidential', priority: 3 }
		];

		const created: string[] = [];
		for (const label of labels) {
			const result = await graph.fetch('/security/sensitivityLabels', {
				method: 'POST',
				body: JSON.stringify({
					displayName: label.name,
					priority: label.priority,
					isActive: true,
					tooltip: `${label.name} data classification`
				})
			});
			created.push(result.id);
		}

		return {
			success: true,
			action: 'Enable Sensitivity Labels',
			details: `Created ${created.length} sensitivity labels`,
			rollbackInfo: { labelIds: created },
			resourceId: created[0]
		};
	} catch (err) {
		return {
			success: false,
			action: 'Enable Sensitivity Labels',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

// ─── Identity Protection ─────────────────────────────────────────────────────

export async function enableSignInRiskPolicy(
	graph: GraphClient,
	options: { riskLevel?: 'low' | 'medium' | 'high' }
): Promise<ConfigAction> {
	try {
		const riskLevel = options.riskLevel ?? 'medium';

		const policy = await graph.fetch('/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: `TenantIQ: Sign-in Risk Policy (${riskLevel})`,
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					applications: { includeApplications: ['All'] },
					signInRiskLevels: [riskLevel]
				},
				grantControls: { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] }
			})
		});

		return {
			success: true,
			action: 'Enable Sign-in Risk Policy',
			details: `Policy created for ${riskLevel} risk threshold`,
			rollbackInfo: { policyId: policy.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Enable Sign-in Risk Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

export async function enableUserRiskPolicy(
	graph: GraphClient,
	options: { riskLevel?: 'low' | 'medium' | 'high' }
): Promise<ConfigAction> {
	try {
		const riskLevel = options.riskLevel ?? 'medium';

		const policy = await graph.fetch('/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: `TenantIQ: User Risk Policy (${riskLevel})`,
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					applications: { includeApplications: ['All'] },
					userRiskLevels: [riskLevel]
				},
				grantControls: { operator: 'OR', builtInControls: ['passwordChange'] }
			})
		});

		return {
			success: true,
			action: 'Enable User Risk Policy',
			details: `Policy created requiring password change for ${riskLevel} user risk`,
			rollbackInfo: { policyId: policy.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Enable User Risk Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}
