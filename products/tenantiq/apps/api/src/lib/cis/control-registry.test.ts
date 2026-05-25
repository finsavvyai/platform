import { describe, it, expect } from 'vitest';
import { ALL_CIS_CONTROLS, ALL_CIS_SECTIONS, CONTROLS_BY_SECTION, CONTROL_COUNTS } from './control-registry';

describe('CIS Control Registry', () => {
	it('has 103+ total controls', () => {
		expect(ALL_CIS_CONTROLS.length).toBeGreaterThanOrEqual(103);
	});

	it('has 7 sections', () => {
		expect(ALL_CIS_SECTIONS).toContain('Identity');
		expect(ALL_CIS_SECTIONS).toContain('Data');
		expect(ALL_CIS_SECTIONS).toContain('Email');
		expect(ALL_CIS_SECTIONS).toContain('Audit');
		expect(ALL_CIS_SECTIONS).toContain('CI/CD');
		expect(ALL_CIS_SECTIONS).toContain('Device');
		expect(ALL_CIS_SECTIONS).toContain('Apps');
	});

	it('has no duplicate control IDs', () => {
		const ids = ALL_CIS_CONTROLS.map(c => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('every control has required fields', () => {
		for (const c of ALL_CIS_CONTROLS) {
			expect(c.id, `Control missing id`).toBeTruthy();
			expect(c.section, `${c.id} missing section`).toBeTruthy();
			expect(c.title, `${c.id} missing title`).toBeTruthy();
			expect(c.description, `${c.id} missing description`).toBeTruthy();
			expect(['critical', 'high', 'medium', 'low'], `${c.id} invalid severity`).toContain(c.severity);
			expect(c.graphCheck, `${c.id} missing graphCheck`).toBeTruthy();
			expect(c.expectedValue, `${c.id} missing expectedValue`).toBeTruthy();
			expect(c.remediationHint, `${c.id} missing remediationHint`).toBeTruthy();
			expect(typeof c.autoRemediable, `${c.id} autoRemediable not boolean`).toBe('boolean');
		}
	});

	it('CONTROLS_BY_SECTION groups correctly', () => {
		for (const section of ALL_CIS_SECTIONS) {
			const sectionControls = CONTROLS_BY_SECTION[section];
			expect(sectionControls, `Missing section: ${section}`).toBeDefined();
			expect(sectionControls.length).toBeGreaterThan(0);
			for (const c of sectionControls) {
				expect(c.section).toBe(section);
			}
		}
	});

	it('CONTROL_COUNTS match actual data', () => {
		expect(CONTROL_COUNTS.total).toBe(ALL_CIS_CONTROLS.length);
		expect(CONTROL_COUNTS.sections).toBe(ALL_CIS_SECTIONS.length);
		expect(CONTROL_COUNTS.critical + CONTROL_COUNTS.high + CONTROL_COUNTS.medium + CONTROL_COUNTS.low).toBe(CONTROL_COUNTS.total);
	});

	it('Identity section has 25 controls', () => {
		expect(CONTROLS_BY_SECTION['Identity'].length).toBe(25);
	});

	it('Data section has 25 controls', () => {
		expect(CONTROLS_BY_SECTION['Data'].length).toBe(25);
	});

	it('all Identity controls have section Identity', () => {
		for (const c of CONTROLS_BY_SECTION['Identity']) {
			expect(c.section).toBe('Identity');
			expect(c.id).toMatch(/^1\./);
		}
	});

	it('critical controls include MFA and audit logging', () => {
		const criticalIds = ALL_CIS_CONTROLS.filter(c => c.severity === 'critical').map(c => c.id);
		expect(criticalIds).toContain('1.1.1'); // MFA for all
		expect(criticalIds).toContain('5.1.1'); // Audit logging
	});

	it('Device section has 13 controls', () => {
		expect(CONTROLS_BY_SECTION['Device'].length).toBe(13);
	});

	it('Apps section has 13 controls', () => {
		expect(CONTROLS_BY_SECTION['Apps'].length).toBe(13);
	});

	it('email controls include SPF, DKIM, DMARC', () => {
		const emailChecks = CONTROLS_BY_SECTION['Email'].map(c => c.graphCheck);
		expect(emailChecks).toContain('spf_configured');
		expect(emailChecks).toContain('dkim_enabled');
		expect(emailChecks).toContain('dmarc_configured');
	});
});
