import { describe, expect, it } from 'vitest';
import type { TenantSecurityData } from './types';
import { evaluateGDPR } from './gdpr-engine';

const fullCompliance: TenantSecurityData = {
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

const noCompliance: TenantSecurityData = {
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

describe('GDPR Engine', () => {
	it('returns all 8 controls', () => {
		const result = evaluateGDPR(fullCompliance);
		expect(result.controls).toHaveLength(8);
	});

	it('sets framework to GDPR', () => {
		const result = evaluateGDPR(fullCompliance);
		expect(result.framework).toBe('GDPR');
		for (const ctrl of result.controls) {
			expect(ctrl.framework).toBe('GDPR');
		}
	});

	it('high score with full compliance data', () => {
		const result = evaluateGDPR(fullCompliance);
		expect(result.score).toBeGreaterThanOrEqual(70);
		expect(result.passCount).toBeGreaterThan(result.failCount);
	});

	it('low score with no compliance data', () => {
		const result = evaluateGDPR(noCompliance);
		expect(result.score).toBeLessThanOrEqual(15);
		expect(result.failCount).toBeGreaterThan(result.passCount);
	});

	it('each control has id, name, evidence', () => {
		const result = evaluateGDPR(fullCompliance);
		for (const ctrl of result.controls) {
			expect(ctrl.id).toBeTruthy();
			expect(ctrl.name).toBeTruthy();
			expect(ctrl.evidence).toBeTruthy();
		}
	});

	it('failing controls include remediation', () => {
		const result = evaluateGDPR(noCompliance);
		const failing = result.controls.filter((c) => c.status !== 'pass');
		expect(failing.length).toBeGreaterThan(0);
		for (const ctrl of failing) {
			expect(ctrl.remediation).toBeTruthy();
		}
	});

	it('passing controls omit remediation', () => {
		const result = evaluateGDPR(fullCompliance);
		const passing = result.controls.filter((c) => c.status === 'pass');
		for (const ctrl of passing) {
			expect(ctrl.remediation).toBeUndefined();
		}
	});

	it('Art-33 breach notification is never pass (requires manual verification)', () => {
		const result = evaluateGDPR(fullCompliance);
		const art33 = result.controls.find((c) => c.id === 'Art-33');
		expect(art33?.status).not.toBe('pass');
	});

	it('counts pass + fail + partial = 8', () => {
		const result = evaluateGDPR(fullCompliance);
		expect(result.passCount + result.failCount + result.partialCount).toBe(8);
	});

	it('score is between 0 and 100', () => {
		const result = evaluateGDPR(noCompliance);
		expect(result.score).toBeGreaterThanOrEqual(0);
		expect(result.score).toBeLessThanOrEqual(100);
	});
});
