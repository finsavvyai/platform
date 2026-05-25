import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS } from '@tenantiq/shared';

const serviceHealthDegradation: Rule = {
	id: RULE_IDS.OPS_001,
	name: 'Service health degradation',
	severity: 'high',
	category: 'operational',
	remediationType: 'manual',
	async evaluate(tenant: Tenant, _data: TenantData): Promise<AlertCandidate[]> {
		if (tenant.lastSyncAt) {
			const hoursAgo = (Date.now() - new Date(tenant.lastSyncAt).getTime()) / (60 * 60 * 1000);
			if (hoursAgo > 12) {
				return [{
					ruleId: RULE_IDS.OPS_001,
					title: `Data sync delayed: last sync was ${Math.round(hoursAgo)} hours ago`,
					description: `Tenant data hasn't been synced for over 12 hours.`,
					businessImpact: 'Dashboard data may be stale',
					affectedResources: [{ tenantId: tenant.id, lastSync: tenant.lastSyncAt }],
					recommendedAction: 'Check tenant connectivity and re-authorize if needed.'
				}];
			}
		}
		return [];
	}
};

const syncErrors: Rule = {
	id: RULE_IDS.OPS_002,
	name: 'Sync errors detected',
	severity: 'medium',
	category: 'operational',
	remediationType: 'manual',
	async evaluate(tenant: Tenant, _data: TenantData): Promise<AlertCandidate[]> {
		if (tenant.status === 'active' && !tenant.lastSyncAt) {
			return [{
				ruleId: RULE_IDS.OPS_002,
				title: 'Tenant has never completed a data sync',
				description: 'Active tenant with no successful sync. Verify OAuth consent.',
				businessImpact: 'No data available for analysis',
				affectedResources: [{ tenantId: tenant.id }],
				recommendedAction: 'Re-run tenant onboarding to ensure proper OAuth consent.'
			}];
		}
		return [];
	}
};

export const operationalRules: Rule[] = [serviceHealthDegradation, syncErrors];
