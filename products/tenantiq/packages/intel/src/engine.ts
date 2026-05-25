import type { Rule, Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { securityRules } from './rules/security';
import { optimizationRules } from './rules/optimization';
import { complianceRules } from './rules/compliance';
import { operationalRules } from './rules/operational';
import { backupHealthRules } from './rules/backup-health';

/**
 * Intelligence Engine rule runner.
 * Evaluates all registered rules against tenant data and produces alert candidates.
 */
export class RuleEngine {
	private rules: Rule[];

	constructor() {
		this.rules = [...securityRules, ...optimizationRules, ...complianceRules, ...operationalRules, ...backupHealthRules];
	}

	/**
	 * Run all rules against the tenant data.
	 */
	async evaluateAll(tenant: Tenant, data: TenantData): Promise<AlertCandidate[]> {
		const alerts: AlertCandidate[] = [];

		for (const rule of this.rules) {
			try {
				const ruleAlerts = await rule.evaluate(tenant, data);
				alerts.push(...ruleAlerts);
			} catch (error) {
				console.error(`[RuleEngine] Rule ${rule.id} failed:`, error);
			}
		}

		return alerts;
	}

	/**
	 * Run rules in a specific category.
	 */
	async evaluateCategory(
		category: 'security' | 'optimization' | 'compliance' | 'operational',
		tenant: Tenant,
		data: TenantData
	): Promise<AlertCandidate[]> {
		const filtered = this.rules.filter((r) => r.category === category);
		const alerts: AlertCandidate[] = [];

		for (const rule of filtered) {
			try {
				const ruleAlerts = await rule.evaluate(tenant, data);
				alerts.push(...ruleAlerts);
			} catch (error) {
				console.error(`[RuleEngine] Rule ${rule.id} failed:`, error);
			}
		}

		return alerts;
	}

	/**
	 * Get all registered rule definitions.
	 */
	getRules(): Omit<Rule, 'evaluate'>[] {
		return this.rules.map(({ evaluate, ...rest }) => rest);
	}
}
