import { describe, it, expect } from 'vitest';
import { securityRules } from './security';
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

describe('Security Rules', () => {
	it('should have correct metadata for all rules', () => {
		expect(securityRules.length).toBe(6);

		for (const rule of securityRules) {
			expect(rule.id).toMatch(/^SEC-\d{3}$/);
			expect(rule.category).toBe('security');
			expect(['critical', 'high', 'medium', 'low']).toContain(rule.severity);
			expect(['automatic', 'semi_automatic', 'manual']).toContain(rule.remediationType);
			expect(typeof rule.evaluate).toBe('function');
		}
	});

	it('should include all expected rule IDs', () => {
		const ids = securityRules.map((r) => r.id);
		expect(ids).toContain('SEC-001');
		expect(ids).toContain('SEC-002');
		expect(ids).toContain('SEC-003');
		expect(ids).toContain('SEC-004');
		expect(ids).toContain('SEC-005');
		expect(ids).toContain('SEC-006');
	});

	describe('SEC-001: MFA not enforced', () => {
		const rule = securityRules.find((r) => r.id === 'SEC-001')!;

		it('should return empty for empty policies', async () => {
			const data: TenantData = { users: [], licenses: [], conditionalAccessPolicies: [] };
			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts).toHaveLength(0);
		});

		it('should alert when policies exist but none enforce MFA for admins', async () => {
			const data: TenantData = {
				users: [],
				licenses: [],
				conditionalAccessPolicies: [
					{ displayName: 'No MFA Policy', state: 'enabled', grantControls: { builtInControls: ['block'] } }
				]
			};
			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts.length).toBeGreaterThan(0);
			expect(alerts[0].ruleId).toBe('SEC-001');
		});
	});

	describe('SEC-003: Impossible travel', () => {
		const rule = securityRules.find((r) => r.id === 'SEC-003')!;

		it('should return empty for no sign-in logs', async () => {
			const data: TenantData = { users: [], licenses: [], signInLogs: [] };
			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts).toHaveLength(0);
		});

		it('should detect sign-ins from different countries within 1 hour', async () => {
			const now = Date.now();
			const data: TenantData = {
				users: [],
				licenses: [],
				signInLogs: [
					{
						userId: 'user1',
						userPrincipalName: 'user1@test.com',
						createdDateTime: new Date(now - 3600000).toISOString(),
						status: { errorCode: 0 },
						location: { countryOrRegion: 'United States', city: 'New York' }
					},
					{
						userId: 'user1',
						userPrincipalName: 'user1@test.com',
						createdDateTime: new Date(now).toISOString(),
						status: { errorCode: 0 },
						location: { countryOrRegion: 'Japan', city: 'Tokyo' }
					}
				]
			};

			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts.length).toBeGreaterThan(0);
			expect(alerts[0].ruleId).toBe('SEC-003');
		});

		it('should detect impossible travel via geo-coordinates', async () => {
			const now = Date.now();
			const data: TenantData = {
				users: [],
				licenses: [],
				signInLogs: [
					{
						userId: 'user2',
						userPrincipalName: 'user2@test.com',
						createdDateTime: new Date(now - 1800000).toISOString(), // 30 min ago
						status: { errorCode: 0 },
						location: {
							countryOrRegion: 'US',
							geoCoordinates: { latitude: 40.7128, longitude: -74.0060 } // NYC
						}
					},
					{
						userId: 'user2',
						userPrincipalName: 'user2@test.com',
						createdDateTime: new Date(now).toISOString(),
						status: { errorCode: 0 },
						location: {
							countryOrRegion: 'UK',
							geoCoordinates: { latitude: 51.5074, longitude: -0.1278 } // London
						}
					}
				]
			};

			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts.length).toBeGreaterThan(0);
			expect(alerts[0].ruleId).toBe('SEC-003');
		});

		it('should not flag normal travel speed', async () => {
			const now = Date.now();
			const data: TenantData = {
				users: [],
				licenses: [],
				signInLogs: [
					{
						userId: 'user3',
						userPrincipalName: 'user3@test.com',
						createdDateTime: new Date(now - 36000000).toISOString(), // 10 hours ago
						status: { errorCode: 0 },
						location: {
							countryOrRegion: 'US',
							geoCoordinates: { latitude: 40.7128, longitude: -74.0060 }
						}
					},
					{
						userId: 'user3',
						userPrincipalName: 'user3@test.com',
						createdDateTime: new Date(now).toISOString(),
						status: { errorCode: 0 },
						location: {
							countryOrRegion: 'UK',
							geoCoordinates: { latitude: 51.5074, longitude: -0.1278 }
						}
					}
				]
			};

			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts).toHaveLength(0);
		});
	});

	describe('SEC-004: Failed login spike', () => {
		const rule = securityRules.find((r) => r.id === 'SEC-004')!;

		it('should not alert with few failed logins', async () => {
			const data: TenantData = {
				users: [],
				licenses: [],
				signInLogs: Array.from({ length: 10 }, (_, i) => ({
					status: { errorCode: 50126 },
					createdDateTime: new Date(Date.now() - i * 60000).toISOString(),
					ipAddress: '10.0.0.1'
				}))
			};
			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts).toHaveLength(0);
		});

		it('should alert with 100+ failed logins in 24 hours', async () => {
			const data: TenantData = {
				users: [],
				licenses: [],
				signInLogs: Array.from({ length: 150 }, (_, i) => ({
					status: { errorCode: 50126 },
					createdDateTime: new Date(Date.now() - i * 1000).toISOString(),
					ipAddress: `10.0.0.${i % 5}`
				}))
			};
			const alerts = await rule.evaluate(mockTenant, data);
			expect(alerts.length).toBeGreaterThan(0);
			expect(alerts[0].ruleId).toBe('SEC-004');
			expect(alerts[0].affectedResources.length).toBeGreaterThan(0);
		});
	});
});
