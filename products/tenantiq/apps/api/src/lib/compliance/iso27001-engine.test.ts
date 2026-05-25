import { describe, it, expect } from 'vitest';
import { evaluateISO27001, ISO_27001_OUT_OF_SCOPE_CONTROLS } from './iso27001-engine';
import type { TenantSecurityDataNullable } from './types';

const strong: TenantSecurityDataNullable = {
	mfaRate: 0.95,
	caEnabled: 5,
	caTotal: 5,
	auditEnabled: true,
	dlpPolicies: 3,
	sensitivityLabels: 4,
	secureScore: 75,
	riskyUsers: 0,
	backupConfigured: true,
	encryptionEnabled: true,
};

const weak: TenantSecurityDataNullable = {
	mfaRate: 0.3, caEnabled: 0, caTotal: 0, auditEnabled: false,
	dlpPolicies: 0, sensitivityLabels: 0, secureScore: 30,
	riskyUsers: 50, backupConfigured: false, encryptionEnabled: true,
};

describe('evaluateISO27001', () => {
	it('returns 25 telemetry-evaluable controls', () => {
		expect(evaluateISO27001(strong).controls).toHaveLength(25);
	});

	it('flags out-of-scope = 93 - 25 = 68 organisational controls', () => {
		expect(ISO_27001_OUT_OF_SCOPE_CONTROLS).toBe(68);
	});

	it('strong tenant scores 70+', () => {
		const r = evaluateISO27001(strong);
		expect(r.score).toBeGreaterThanOrEqual(70);
		expect(r.framework).toBe('ISO 27001');
	});

	it('weak tenant scores below 30', () => {
		const r = evaluateISO27001(weak);
		expect(r.score).toBeLessThan(30);
	});

	it('passes A.5.16 Identity management when MFA >= 90%', () => {
		const r = evaluateISO27001(strong);
		expect(r.controls.find(c => c.id === 'A.5.16')?.status).toBe('pass');
	});

	it('fails A.8.15 Logging when audit disabled', () => {
		const r = evaluateISO27001(weak);
		expect(r.controls.find(c => c.id === 'A.8.15')?.status).toBe('fail');
	});

	it('marks errors when input fields are null', () => {
		const partial: TenantSecurityDataNullable = {
			...strong, mfaRate: null, secureScore: null, dlpPolicies: null,
			sensitivityLabels: null, caEnabled: null, auditEnabled: null,
			riskyUsers: null, backupConfigured: null, encryptionEnabled: null,
		};
		const r = evaluateISO27001(partial);
		expect(r.errorCount).toBeGreaterThan(20);
	});

	it('every control has a remediation when not error', () => {
		const r = evaluateISO27001(strong);
		for (const c of r.controls) {
			if (c.status !== 'error') expect(c.remediation).toBeDefined();
		}
	});

	it('control IDs follow ISO Annex A format A.X.Y', () => {
		const r = evaluateISO27001(strong);
		for (const c of r.controls) {
			expect(c.id).toMatch(/^A\.\d+\.\d+$/);
		}
	});
});
