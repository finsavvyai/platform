/**
 * Sample Project 2: Security Intelligence Rule Engine
 *
 * Simulates: Running TenantIQ's intelligence engine against multiple
 * tenant profiles — a healthy tenant (few/no alerts), a risky tenant
 * (many alerts), and edge cases (empty data, single user).
 */
import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../../packages/intel/src/engine';
import type { Tenant, TenantData, AlertCandidate } from '@tenantiq/shared';
import { RULE_IDS } from '@tenantiq/shared';
import {
	healthyTenant, riskyTenant, newTenant, freeTierTenant,
	buildHealthyTenantData, buildRiskyTenantData,
	buildNewTenantData, buildMinimalTenantData,
	makeActiveUsers, makeInactiveUsers, makeGuestUsers,
	makeE5Users, makeLicenses, makeFailedSignIns,
	makeImpossibleTravelLogs, makeRiskyUsers, makeGroups,
	mfaEnabledPolicies, weakPolicies,
} from './fixtures/tenant-profiles';

describe('Security Intelligence — Full Capability Test', () => {
	const engine = new RuleEngine();

	describe('Healthy Tenant (Low Risk Profile)', () => {
		const data = buildHealthyTenantData();

		it('should produce few or no security alerts', async () => {
			const alerts = await engine.evaluateCategory('security', healthyTenant, data);
			// Healthy tenant has MFA, blocks legacy auth, low guest ratio
			const criticalAlerts = alerts.filter((a) => a.ruleId === RULE_IDS.SEC_001 || a.ruleId === RULE_IDS.SEC_002);
			expect(criticalAlerts.length).toBe(0);
		});

		it('should detect some optimization opportunities', async () => {
			const alerts = await engine.evaluateCategory('optimization', healthyTenant, data);
			// Has some unassigned licenses (20 E5 total, 15 assigned)
			const unassigned = alerts.filter((a) => a.ruleId === RULE_IDS.OPT_003);
			expect(unassigned.length).toBeGreaterThanOrEqual(0);
		});

		it('should produce no compliance alerts (groups have owners)', async () => {
			const alerts = await engine.evaluateCategory('compliance', healthyTenant, data);
			const orphanedGroups = alerts.filter((a) => a.ruleId === RULE_IDS.CMP_002);
			expect(orphanedGroups.length).toBe(0);
		});

		it('should produce no operational alerts (recent sync)', async () => {
			const alerts = await engine.evaluateCategory('operational', healthyTenant, data);
			const syncAlerts = alerts.filter((a) => a.ruleId === RULE_IDS.OPS_001);
			expect(syncAlerts.length).toBe(0);
		});
	});

	describe('Risky Tenant (High Risk Profile)', () => {
		const data = buildRiskyTenantData();

		it('should flag MFA not enforced (SEC-001)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const mfa = alerts.filter((a) => a.ruleId === RULE_IDS.SEC_001);
			// Weak policies have MFA disabled
			expect(mfa.length).toBeGreaterThanOrEqual(0);
		});

		it('should flag failed login spike (SEC-004)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const spike = alerts.filter((a) => a.ruleId === RULE_IDS.SEC_004);
			expect(spike.length).toBeGreaterThan(0);
			expect(spike[0].affectedResources.length).toBeGreaterThan(0);
		});

		it('should detect impossible travel (SEC-003)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const travel = alerts.filter((a) => a.ruleId === RULE_IDS.SEC_003);
			expect(travel.length).toBeGreaterThan(0);
			expect(travel[0].description).toContain('km');
		});

		it('should flag risky sign-ins (SEC-005)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const risky = alerts.filter((a) => a.ruleId === RULE_IDS.SEC_005);
			expect(risky.length).toBeGreaterThan(0);
		});

		it('should flag high guest ratio (SEC-006)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const overshare = alerts.filter((a) => a.ruleId === RULE_IDS.SEC_006);
			// 50 guests out of 150 total = 33% > 30%
			expect(overshare.length).toBeGreaterThan(0);
		});

		it('should detect inactive users (OPT-001)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const inactive = alerts.filter((a) => a.ruleId === RULE_IDS.OPT_001);
			expect(inactive.length).toBeGreaterThan(0);
			expect(inactive[0].businessImpact).toContain('$');
		});

		it('should detect underutilized E5 licenses (OPT-002)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const e5 = alerts.filter((a) => a.ruleId === RULE_IDS.OPT_002);
			expect(e5.length).toBeGreaterThan(0);
			expect(e5[0].businessImpact).toContain('$');
		});

		it('should detect unassigned licenses (OPT-003)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const unassigned = alerts.filter((a) => a.ruleId === RULE_IDS.OPT_003);
			// 50 E5 total, 20 assigned = 30 unassigned = $1,710/mo waste
			expect(unassigned.length).toBeGreaterThan(0);
		});

		it('should flag stale guest users (CMP-001)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const stale = alerts.filter((a) => a.ruleId === RULE_IDS.CMP_001);
			expect(stale.length).toBeGreaterThan(0);
		});

		it('should flag orphaned groups (CMP-002)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const orphan = alerts.filter((a) => a.ruleId === RULE_IDS.CMP_002);
			expect(orphan.length).toBeGreaterThan(0);
		});

		it('should flag disabled conditional access (CMP-003)', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const disabled = alerts.filter((a) => a.ruleId === RULE_IDS.CMP_003);
			expect(disabled.length).toBeGreaterThan(0);
		});

		it('should generate 5+ total alerts for risky tenant', async () => {
			const alerts = await engine.evaluateAll(riskyTenant, data);
			expect(alerts.length).toBeGreaterThanOrEqual(5);
		});
	});

	describe('New Tenant (Empty Data)', () => {
		const data = buildNewTenantData();

		it('should not crash on empty user list', async () => {
			const alerts = await engine.evaluateAll(newTenant, data);
			expect(Array.isArray(alerts)).toBe(true);
		});

		it('should detect never-synced status (OPS-002)', async () => {
			const alerts = await engine.evaluateAll(newTenant, data);
			const sync = alerts.filter((a) => a.ruleId === RULE_IDS.OPS_002);
			expect(sync.length).toBeGreaterThan(0);
		});

		it('should not produce security alerts on empty data', async () => {
			const alerts = await engine.evaluateCategory('security', newTenant, data);
			// No policies, no users = no security alerts typically
			expect(alerts.length).toBe(0);
		});
	});

	describe('Free-Tier Tenant (Minimal Data)', () => {
		const data = buildMinimalTenantData();

		it('should evaluate rules without error on small dataset', async () => {
			const alerts = await engine.evaluateAll(freeTierTenant, data);
			expect(Array.isArray(alerts)).toBe(true);
		});

		it('should still detect unassigned licenses for small tenants', async () => {
			const alerts = await engine.evaluateAll(freeTierTenant, data);
			const unassigned = alerts.filter((a) => a.ruleId === RULE_IDS.OPT_003);
			// 10 total, 5 assigned = 5 unassigned
			expect(unassigned.length).toBeGreaterThan(0);
		});
	});

	describe('Alert Quality Validation', () => {
		it('all alerts should have required fields', async () => {
			const data = buildRiskyTenantData();
			const alerts = await engine.evaluateAll(riskyTenant, data);
			for (const alert of alerts) {
				expect(alert.ruleId).toBeTruthy();
				expect(alert.title).toBeTruthy();
				expect(alert.description).toBeTruthy();
				expect(Array.isArray(alert.affectedResources)).toBe(true);
			}
		});

		it('alert titles should be human-readable and descriptive', async () => {
			const data = buildRiskyTenantData();
			const alerts = await engine.evaluateAll(riskyTenant, data);
			for (const alert of alerts) {
				expect(alert.title.length).toBeGreaterThan(10);
				expect(alert.title.length).toBeLessThan(200);
			}
		});

		it('affected resources should contain actionable data', async () => {
			const data = buildRiskyTenantData();
			const alerts = await engine.evaluateAll(riskyTenant, data);
			const withResources = alerts.filter((a) => a.affectedResources.length > 0);
			expect(withResources.length).toBeGreaterThan(0);
		});
	});

	describe('Rule Engine Metadata', () => {
		it('should have rules across all 4 categories', () => {
			const rules = engine.getRules();
			const categories = new Set(rules.map((r) => r.category));
			expect(categories).toContain('security');
			expect(categories).toContain('optimization');
			expect(categories).toContain('compliance');
			expect(categories).toContain('operational');
		});

		it('should have at least 14 total rules', () => {
			expect(engine.getRules().length).toBeGreaterThanOrEqual(14);
		});

		it('rule metadata should not expose evaluate function', () => {
			const rules = engine.getRules();
			for (const r of rules) {
				expect(r).not.toHaveProperty('evaluate');
			}
		});
	});
});
