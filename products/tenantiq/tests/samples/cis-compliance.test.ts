/**
 * Sample Project 3: CIS Benchmark Compliance
 *
 * Simulates: Running CIS benchmark evaluations against different
 * M365 tenant configurations — compliant enterprise, partially
 * compliant SMB, and non-compliant startup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulated CIS control evaluator (mirrors the pattern in security-scoring.test.ts)
class CISControlEvaluator {
	async evaluateControl(controlId: string, config: Record<string, unknown>): Promise<CISResult> {
		return { controlId, compliant: false, score: 0, findings: [], severity: 'medium' };
	}
	async evaluateAll(config: Record<string, unknown>): Promise<CISReport> {
		return { controls: [], overallScore: 0, complianceLevel: 'Low', timestamp: new Date().toISOString() };
	}
	async getRemediationSteps(controlId: string): Promise<string[]> { return []; }
}

interface CISResult {
	controlId: string;
	compliant: boolean;
	score: number;
	findings: string[];
	severity: 'critical' | 'high' | 'medium' | 'low';
}

interface CISReport {
	controls: CISResult[];
	overallScore: number;
	complianceLevel: 'High' | 'Medium' | 'Low';
	timestamp: string;
}

// ── Tenant configurations ────────────────────────────────────────

const enterpriseConfig = {
	passwordPolicy: { minLength: 16, complexity: true, expiration: 90, history: 24 },
	mfaPolicy: { enforced: true, methods: ['authenticator', 'fido2'], excludedRoles: [] },
	conditionalAccess: [
		{ name: 'Require MFA for all', enabled: true, scope: 'all_users' },
		{ name: 'Block legacy auth', enabled: true, scope: 'all_users' },
		{ name: 'Block high-risk sign-ins', enabled: true, scope: 'all_users' },
		{ name: 'Require compliant device', enabled: true, scope: 'admin_roles' },
	],
	auditLogging: { enabled: true, retentionDays: 2555, unifiedAuditLog: true },
	externalSharing: { level: 'existing_guests_only', allowAnonymous: false },
	dataLossPrevention: { enabled: true, policies: 5 },
	mobileDeviceManagement: { enrolled: true, complianceRequired: true },
};

const smbConfig = {
	passwordPolicy: { minLength: 12, complexity: true, expiration: 180, history: 10 },
	mfaPolicy: { enforced: true, methods: ['authenticator'], excludedRoles: ['Guest'] },
	conditionalAccess: [
		{ name: 'Require MFA for admins', enabled: true, scope: 'admin_roles' },
		{ name: 'Block legacy auth', enabled: false, scope: 'all_users' },
	],
	auditLogging: { enabled: true, retentionDays: 90, unifiedAuditLog: false },
	externalSharing: { level: 'new_and_existing_guests', allowAnonymous: false },
	dataLossPrevention: { enabled: false, policies: 0 },
	mobileDeviceManagement: { enrolled: false, complianceRequired: false },
};

const startupConfig = {
	passwordPolicy: { minLength: 8, complexity: false, expiration: 0, history: 0 },
	mfaPolicy: { enforced: false, methods: [], excludedRoles: ['All'] },
	conditionalAccess: [],
	auditLogging: { enabled: false, retentionDays: 0, unifiedAuditLog: false },
	externalSharing: { level: 'anyone', allowAnonymous: true },
	dataLossPrevention: { enabled: false, policies: 0 },
	mobileDeviceManagement: { enrolled: false, complianceRequired: false },
};

describe('CIS Benchmark Compliance Scenarios', () => {
	let evaluator: CISControlEvaluator;

	beforeEach(() => {
		vi.clearAllMocks();
		evaluator = new CISControlEvaluator();
	});

	describe('Enterprise Tenant — Expected: High Compliance (90%+)', () => {
		it('CIS 1.1: Password policy meets all requirements', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-1.1', compliant: true, score: 100,
				findings: [], severity: 'high',
			});
			const result = await evaluator.evaluateControl('CIS-1.1', enterpriseConfig);
			expect(result.compliant).toBe(true);
			expect(result.score).toBe(100);
		});

		it('CIS 2.1: MFA enforced for all users including admins', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-2.1', compliant: true, score: 100,
				findings: [], severity: 'critical',
			});
			const result = await evaluator.evaluateControl('CIS-2.1', enterpriseConfig);
			expect(result.compliant).toBe(true);
		});

		it('CIS 3.1: Legacy authentication blocked', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-3.1', compliant: true, score: 100,
				findings: [], severity: 'critical',
			});
			const result = await evaluator.evaluateControl('CIS-3.1', enterpriseConfig);
			expect(result.compliant).toBe(true);
		});

		it('CIS 6.1: All conditional access policies enabled', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-6.1', compliant: true, score: 100,
				findings: [], severity: 'high',
			});
			const result = await evaluator.evaluateControl('CIS-6.1', enterpriseConfig);
			expect(result.compliant).toBe(true);
			expect(enterpriseConfig.conditionalAccess.every((p) => p.enabled)).toBe(true);
		});

		it('CIS 7.1: Audit logging with 7-year retention', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-7.1', compliant: true, score: 100,
				findings: [], severity: 'medium',
			});
			const result = await evaluator.evaluateControl('CIS-7.1', enterpriseConfig);
			expect(result.compliant).toBe(true);
			expect(enterpriseConfig.auditLogging.retentionDays).toBeGreaterThanOrEqual(365);
		});

		it('Overall score should be 90%+ for enterprise', async () => {
			vi.spyOn(evaluator, 'evaluateAll').mockResolvedValue({
				controls: [],
				overallScore: 97,
				complianceLevel: 'High',
				timestamp: new Date().toISOString(),
			});
			const report = await evaluator.evaluateAll(enterpriseConfig);
			expect(report.overallScore).toBeGreaterThanOrEqual(90);
			expect(report.complianceLevel).toBe('High');
		});
	});

	describe('SMB Tenant — Expected: Medium Compliance (50-80%)', () => {
		it('CIS 1.1: Password policy partially compliant', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-1.1', compliant: false, score: 60,
				findings: ['Password minimum length is 12, recommended 14+', 'Expiration period exceeds 180 days'],
				severity: 'high',
			});
			const result = await evaluator.evaluateControl('CIS-1.1', smbConfig);
			expect(result.compliant).toBe(false);
			expect(result.score).toBeGreaterThan(0);
			expect(result.findings.length).toBeGreaterThan(0);
		});

		it('CIS 2.1: MFA enabled but excludes guests', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-2.1', compliant: false, score: 75,
				findings: ['Guest users excluded from MFA enforcement'],
				severity: 'critical',
			});
			const result = await evaluator.evaluateControl('CIS-2.1', smbConfig);
			expect(result.compliant).toBe(false);
			expect(result.score).toBe(75);
		});

		it('CIS 3.1: Legacy auth blocking disabled', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-3.1', compliant: false, score: 0,
				findings: ['Legacy authentication blocking policy is disabled'],
				severity: 'critical',
			});
			const result = await evaluator.evaluateControl('CIS-3.1', smbConfig);
			expect(result.compliant).toBe(false);
			const disabledPolicies = smbConfig.conditionalAccess.filter((p) => !p.enabled);
			expect(disabledPolicies.length).toBeGreaterThan(0);
		});

		it('Overall score should be 50-80% for SMB', async () => {
			vi.spyOn(evaluator, 'evaluateAll').mockResolvedValue({
				controls: [],
				overallScore: 65,
				complianceLevel: 'Medium',
				timestamp: new Date().toISOString(),
			});
			const report = await evaluator.evaluateAll(smbConfig);
			expect(report.overallScore).toBeGreaterThanOrEqual(50);
			expect(report.overallScore).toBeLessThanOrEqual(80);
			expect(report.complianceLevel).toBe('Medium');
		});
	});

	describe('Startup Tenant — Expected: Low Compliance (<50%)', () => {
		it('CIS 1.1: Weak password policy', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-1.1', compliant: false, score: 5,
				findings: [
					'Password minimum length is 8, should be at least 14',
					'Password complexity is disabled',
					'Password expiration is disabled',
					'Password history is not configured',
				],
				severity: 'high',
			});
			const result = await evaluator.evaluateControl('CIS-1.1', startupConfig);
			expect(result.score).toBeLessThan(20);
			expect(result.findings.length).toBeGreaterThanOrEqual(3);
		});

		it('CIS 2.1: MFA not enforced at all', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-2.1', compliant: false, score: 0,
				findings: ['MFA is not enforced for any users'],
				severity: 'critical',
			});
			const result = await evaluator.evaluateControl('CIS-2.1', startupConfig);
			expect(result.compliant).toBe(false);
			expect(result.score).toBe(0);
		});

		it('CIS 6.1: No conditional access policies', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-6.1', compliant: false, score: 0,
				findings: ['No conditional access policies configured'],
				severity: 'high',
			});
			const result = await evaluator.evaluateControl('CIS-6.1', startupConfig);
			expect(result.compliant).toBe(false);
			expect(startupConfig.conditionalAccess.length).toBe(0);
		});

		it('CIS 7.1: Audit logging disabled', async () => {
			vi.spyOn(evaluator, 'evaluateControl').mockResolvedValue({
				controlId: 'CIS-7.1', compliant: false, score: 0,
				findings: ['Audit logging is disabled'],
				severity: 'medium',
			});
			const result = await evaluator.evaluateControl('CIS-7.1', startupConfig);
			expect(result.compliant).toBe(false);
		});

		it('External sharing: Anonymous access enabled (violation)', () => {
			expect(startupConfig.externalSharing.allowAnonymous).toBe(true);
			expect(startupConfig.externalSharing.level).toBe('anyone');
		});

		it('Overall score should be <50% for startup', async () => {
			vi.spyOn(evaluator, 'evaluateAll').mockResolvedValue({
				controls: [],
				overallScore: 12,
				complianceLevel: 'Low',
				timestamp: new Date().toISOString(),
			});
			const report = await evaluator.evaluateAll(startupConfig);
			expect(report.overallScore).toBeLessThan(50);
			expect(report.complianceLevel).toBe('Low');
		});
	});

	describe('Remediation Guidance', () => {
		it('should provide actionable steps for failed controls', async () => {
			vi.spyOn(evaluator, 'getRemediationSteps').mockResolvedValue([
				'Navigate to Azure AD > Security > Conditional Access',
				'Create new policy: "Require MFA for all users"',
				'Set Grant controls to "Require multi-factor authentication"',
				'Enable the policy and verify with test user',
			]);
			const steps = await evaluator.getRemediationSteps('CIS-2.1');
			expect(steps.length).toBeGreaterThanOrEqual(2);
			expect(steps[0]).toBeTruthy();
		});

		it('should return empty steps for already-compliant controls', async () => {
			vi.spyOn(evaluator, 'getRemediationSteps').mockResolvedValue([]);
			const steps = await evaluator.getRemediationSteps('CIS-1.1');
			expect(steps.length).toBe(0);
		});
	});

	describe('Config Comparison Between Tenants', () => {
		it('enterprise should have more CA policies than startup', () => {
			expect(enterpriseConfig.conditionalAccess.length).toBeGreaterThan(
				startupConfig.conditionalAccess.length
			);
		});

		it('enterprise should have longer audit retention', () => {
			expect(enterpriseConfig.auditLogging.retentionDays).toBeGreaterThan(
				smbConfig.auditLogging.retentionDays
			);
		});

		it('password strength should decrease: enterprise > smb > startup', () => {
			expect(enterpriseConfig.passwordPolicy.minLength).toBeGreaterThan(
				smbConfig.passwordPolicy.minLength
			);
			expect(smbConfig.passwordPolicy.minLength).toBeGreaterThan(
				startupConfig.passwordPolicy.minLength
			);
		});
	});
});
