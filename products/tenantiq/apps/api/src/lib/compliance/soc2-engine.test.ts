import { describe, expect, it } from 'vitest';
import type { TenantSecurityData } from './types';
import { evaluateSOC2 } from './soc2-engine';

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
	riskyUsers: 5,
	backupConfigured: false,
	encryptionEnabled: false,
};

const partialData: TenantSecurityData = {
	mfaRate: 0.7,
	caEnabled: 2,
	caTotal: 4,
	auditEnabled: true,
	dlpPolicies: 1,
	sensitivityLabels: 2,
	secureScore: 55,
	riskyUsers: 2,
	backupConfigured: false,
	encryptionEnabled: true,
};

describe('SOC 2 Engine', () => {
	it('returns all 8 controls', () => {
		const result = evaluateSOC2(perfectData);
		expect(result.controls).toHaveLength(8);
	});

	it('sets framework to SOC 2', () => {
		const result = evaluateSOC2(perfectData);
		expect(result.framework).toBe('SOC 2');
		for (const ctrl of result.controls) {
			expect(ctrl.framework).toBe('SOC 2');
		}
	});

	it('scores high with perfect security data', () => {
		const result = evaluateSOC2(perfectData);
		expect(result.score).toBeGreaterThanOrEqual(90);
		expect(result.passCount).toBeGreaterThanOrEqual(7);
		expect(result.failCount).toBe(0);
	});

	it('scores low with zero security data', () => {
		const result = evaluateSOC2(zeroData);
		expect(result.score).toBeLessThanOrEqual(15);
		expect(result.failCount).toBeGreaterThan(0);
	});

	it('returns mix of pass/fail/partial with partial data', () => {
		const result = evaluateSOC2(partialData);
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThan(100);
		const statuses = new Set(result.controls.map((c) => c.status));
		expect(statuses.size).toBeGreaterThanOrEqual(2);
	});

	it('includes remediation text on failing controls', () => {
		const result = evaluateSOC2(zeroData);
		const nonPass = result.controls.filter((c) => c.status !== 'pass');
		expect(nonPass.length).toBeGreaterThan(0);
		for (const ctrl of nonPass) {
			expect(ctrl.remediation).toBeTruthy();
			expect(typeof ctrl.remediation).toBe('string');
		}
	});

	it('passing controls omit remediation', () => {
		const result = evaluateSOC2(perfectData);
		const passing = result.controls.filter((c) => c.status === 'pass');
		expect(passing.length).toBeGreaterThan(0);
		for (const ctrl of passing) {
			expect(ctrl.remediation).toBeUndefined();
		}
	});

	it('every control has id, name, evidence', () => {
		const result = evaluateSOC2(partialData);
		for (const ctrl of result.controls) {
			expect(ctrl.id).toBeTruthy();
			expect(ctrl.name).toBeTruthy();
			expect(ctrl.evidence).toBeTruthy();
		}
	});

	it('counts pass + fail + partial = total controls', () => {
		const result = evaluateSOC2(partialData);
		expect(result.passCount + result.failCount + result.partialCount).toBe(8);
	});
});
