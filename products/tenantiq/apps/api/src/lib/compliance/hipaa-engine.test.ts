import { describe, expect, it } from 'vitest';
import type { TenantSecurityData } from './types';
import { evaluateHIPAA } from './hipaa-engine';

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

describe('HIPAA Engine', () => {
	it('returns all 11 controls', () => {
		const result = evaluateHIPAA(fullCompliance);
		expect(result.controls).toHaveLength(11);
	});

	it('sets framework to HIPAA', () => {
		const result = evaluateHIPAA(fullCompliance);
		expect(result.framework).toBe('HIPAA');
		for (const ctrl of result.controls) {
			expect(ctrl.framework).toBe('HIPAA');
		}
	});

	it('high score with full compliance data', () => {
		const result = evaluateHIPAA(fullCompliance);
		expect(result.score).toBeGreaterThanOrEqual(80);
		expect(result.passCount).toBeGreaterThan(result.failCount);
	});

	it('low score with no compliance data', () => {
		const result = evaluateHIPAA(noCompliance);
		expect(result.score).toBeLessThanOrEqual(10);
		expect(result.failCount).toBeGreaterThan(result.passCount);
	});

	it('includes administrative safeguard controls', () => {
		const result = evaluateHIPAA(fullCompliance);
		const admin = result.controls.filter((c) => c.name.startsWith('Administrative'));
		expect(admin.length).toBeGreaterThanOrEqual(4);
	});

	it('includes physical safeguard controls', () => {
		const result = evaluateHIPAA(fullCompliance);
		const physical = result.controls.filter((c) => c.name.startsWith('Physical'));
		expect(physical.length).toBeGreaterThanOrEqual(3);
	});

	it('includes technical safeguard controls', () => {
		const result = evaluateHIPAA(fullCompliance);
		const technical = result.controls.filter((c) => c.name.startsWith('Technical'));
		expect(technical.length).toBeGreaterThanOrEqual(4);
	});

	it('failing controls include remediation text', () => {
		const result = evaluateHIPAA(noCompliance);
		const failing = result.controls.filter((c) => c.status !== 'pass');
		expect(failing.length).toBeGreaterThan(0);
		for (const ctrl of failing) {
			expect(ctrl.remediation).toBeTruthy();
		}
	});

	it('passing controls omit remediation', () => {
		const result = evaluateHIPAA(fullCompliance);
		const passing = result.controls.filter((c) => c.status === 'pass');
		for (const ctrl of passing) {
			expect(ctrl.remediation).toBeUndefined();
		}
	});

	it('counts pass + fail + partial = 11', () => {
		const result = evaluateHIPAA(fullCompliance);
		expect(result.passCount + result.failCount + result.partialCount).toBe(11);
	});

	it('physical facility control is always partial for cloud', () => {
		const result = evaluateHIPAA(fullCompliance);
		const facility = result.controls.find((c) => c.id === '164.310(a)(1)');
		expect(facility?.status).toBe('partial');
	});
});
