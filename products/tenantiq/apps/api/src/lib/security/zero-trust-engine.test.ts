import { describe, expect, it } from 'vitest';
import type { TenantSecurityData } from '../compliance/types';
import { evaluateZeroTrust } from './zero-trust-engine';

const perfectData: TenantSecurityData = {
	mfaRate: 1.0,
	caEnabled: 5,
	caTotal: 5,
	auditEnabled: true,
	dlpPolicies: 3,
	sensitivityLabels: 5,
	secureScore: 90,
	riskyUsers: 0,
	backupConfigured: true,
	encryptionEnabled: true,
};

const zeroData: TenantSecurityData = {
	mfaRate: 0,
	caEnabled: 0,
	caTotal: 0,
	auditEnabled: false,
	dlpPolicies: 0,
	sensitivityLabels: 0,
	secureScore: 0,
	riskyUsers: 10,
	backupConfigured: false,
	encryptionEnabled: false,
};

const midData: TenantSecurityData = {
	mfaRate: 0.7,
	caEnabled: 2,
	caTotal: 4,
	auditEnabled: true,
	dlpPolicies: 1,
	sensitivityLabels: 2,
	secureScore: 60,
	riskyUsers: 1,
	backupConfigured: true,
	encryptionEnabled: false,
};

describe('Zero Trust Engine', () => {
	it('returns exactly 6 pillars', () => {
		const result = evaluateZeroTrust(perfectData);
		expect(result.pillars).toHaveLength(6);
	});

	it('includes Identity, Devices, Network, Applications, Data, Infrastructure', () => {
		const result = evaluateZeroTrust(perfectData);
		const names = result.pillars.map((p) => p.name);
		expect(names).toContain('Identity');
		expect(names).toContain('Devices');
		expect(names).toContain('Network');
		expect(names).toContain('Applications');
		expect(names).toContain('Data');
		expect(names).toContain('Infrastructure');
	});

	it('advanced or optimal maturity with perfect data', () => {
		const result = evaluateZeroTrust(perfectData);
		expect(['advanced', 'optimal']).toContain(result.maturityLevel);
		expect(result.overallScore).toBeGreaterThanOrEqual(50);
	});

	it('initial maturity with zero data', () => {
		const result = evaluateZeroTrust(zeroData);
		expect(result.maturityLevel).toBe('initial');
		expect(result.overallScore).toBeLessThan(50);
	});

	it('advanced maturity with mid data', () => {
		const result = evaluateZeroTrust(midData);
		expect(result.overallScore).toBeGreaterThanOrEqual(25);
		expect(result.overallScore).toBeLessThan(100);
	});

	it('pillar scores are 0-100', () => {
		const result = evaluateZeroTrust(midData);
		for (const pillar of result.pillars) {
			expect(pillar.score).toBeGreaterThanOrEqual(0);
			expect(pillar.score).toBeLessThanOrEqual(100);
		}
	});

	it('overall score is average of pillar scores', () => {
		const result = evaluateZeroTrust(midData);
		const avg = Math.round(
			result.pillars.reduce((s, p) => s + p.score, 0) / result.pillars.length,
		);
		expect(result.overallScore).toBe(avg);
	});

	it('each pillar has checks and recommendations', () => {
		const result = evaluateZeroTrust(zeroData);
		for (const pillar of result.pillars) {
			expect(pillar.checks.length).toBeGreaterThan(0);
			expect(Array.isArray(pillar.recommendations)).toBe(true);
		}
	});

	it('checks have name, status, evidence', () => {
		const result = evaluateZeroTrust(perfectData);
		for (const pillar of result.pillars) {
			for (const check of pillar.checks) {
				expect(check.name).toBeTruthy();
				expect(['pass', 'fail', 'partial']).toContain(check.status);
				expect(check.evidence).toBeTruthy();
			}
		}
	});

	it('zero data pillars generate recommendations', () => {
		const result = evaluateZeroTrust(zeroData);
		const totalRecs = result.pillars.reduce((s, p) => s + p.recommendations.length, 0);
		expect(totalRecs).toBeGreaterThan(0);
	});
});
