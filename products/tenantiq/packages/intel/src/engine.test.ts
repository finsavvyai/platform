import { describe, it, expect } from 'vitest';
import { RuleEngine } from './engine';
import type { Tenant, TenantData } from '@tenantiq/shared';

const mockTenant: Tenant = {
	id: 'test-tenant-001',
	organizationId: 'test-org-001',
	azureTenantId: 'azure-test-001',
	displayName: 'Test Corp',
	domain: 'testcorp.com',
	lastSyncAt: null,
	status: 'active',
	createdAt: new Date().toISOString()
};

const emptyData: TenantData = {
	users: [],
	licenses: [],
	conditionalAccessPolicies: [],
	signInLogs: [],
	riskyUsers: []
};

describe('RuleEngine', () => {
	it('should initialize with rules from all 4 categories', () => {
		const engine = new RuleEngine();
		const rules = engine.getRules();
		expect(rules.length).toBeGreaterThan(0);

		const categories = new Set(rules.map((r) => r.category));
		expect(categories.has('security')).toBe(true);
		expect(categories.has('optimization')).toBe(true);
		expect(categories.has('compliance')).toBe(true);
		expect(categories.has('operational')).toBe(true);
	});

	it('should return rule metadata without evaluate function', () => {
		const engine = new RuleEngine();
		const rules = engine.getRules();

		for (const rule of rules) {
			expect(rule).toHaveProperty('id');
			expect(rule).toHaveProperty('name');
			expect(rule).toHaveProperty('severity');
			expect(rule).toHaveProperty('category');
			expect(rule).not.toHaveProperty('evaluate');
		}
	});

	it('should evaluate all rules without throwing on empty data', async () => {
		const engine = new RuleEngine();
		const alerts = await engine.evaluateAll(mockTenant, emptyData);
		expect(Array.isArray(alerts)).toBe(true);
	});

	it('should filter rules by category', async () => {
		const engine = new RuleEngine();

		const securityAlerts = await engine.evaluateCategory('security', mockTenant, emptyData);
		expect(Array.isArray(securityAlerts)).toBe(true);

		const optimizationAlerts = await engine.evaluateCategory('optimization', mockTenant, emptyData);
		expect(Array.isArray(optimizationAlerts)).toBe(true);
	});

	it('should have at least 14 rules registered', () => {
		const engine = new RuleEngine();
		const rules = engine.getRules();
		// 6 security + 3 optimization + 3 compliance + 2 operational
		expect(rules.length).toBeGreaterThanOrEqual(14);
	});

	it('should produce valid AlertCandidate objects', async () => {
		const engine = new RuleEngine();

		// Provide data that triggers at least one rule (SEC-004: failed logins)
		const dataWithFailedLogins: TenantData = {
			users: [],
			licenses: [],
			signInLogs: Array.from({ length: 150 }, (_, i) => ({
				status: { errorCode: 50126 },
				createdDateTime: new Date(Date.now() - i * 1000).toISOString(),
				ipAddress: `10.0.0.${i % 10}`
			}))
		};

		const alerts = await engine.evaluateAll(mockTenant, dataWithFailedLogins);
		expect(alerts.length).toBeGreaterThan(0);

		for (const alert of alerts) {
			expect(alert).toHaveProperty('ruleId');
			expect(alert).toHaveProperty('title');
			expect(alert).toHaveProperty('description');
			expect(alert).toHaveProperty('affectedResources');
			expect(Array.isArray(alert.affectedResources)).toBe(true);
		}
	});
});
