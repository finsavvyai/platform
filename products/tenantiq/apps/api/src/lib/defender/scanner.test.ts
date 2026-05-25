import { describe, expect, it } from 'vitest';
import { assembleDefenderScan, type RawSecureScoreControl, type RawSecureScoreControlProfile } from './scanner';

function profile(overrides: Partial<RawSecureScoreControlProfile> = {}): RawSecureScoreControlProfile {
	return {
		id: overrides.id ?? 'ctrl-' + Math.random().toString(36).slice(2, 8),
		title: 'Enable Safe Links policy',
		controlCategory: 'Apps',
		service: 'Defender for Office 365',
		maxScore: 8,
		actionUrl: 'https://security.microsoft.com/safelinkv2',
		remediation: 'Open Defender → Threat policies → Safe Links and enable.',
		...overrides,
	};
}

function score(overrides: Partial<RawSecureScoreControl> = {}): RawSecureScoreControl {
	return {
		controlName: 'ctrl-1',
		score: 8,
		implementationStatus: 'Implemented',
		...overrides,
	};
}

describe('Defender ATP scanner', () => {
	it('returns empty result when no Defender controls present', () => {
		const r = assembleDefenderScan({
			controlProfiles: [profile({ id: 'p-1', title: 'Use a custom domain', service: 'SharePoint' })],
			controlScores: [score({ controlName: 'p-1' })],
		});
		expect(r.summary.totalControls).toBe(0);
		expect(r.findings).toHaveLength(0);
	});

	it('marks fully-scored Defender control as covered', () => {
		const r = assembleDefenderScan({
			controlProfiles: [profile({ id: 'safelink-1' })],
			controlScores: [score({ controlName: 'safelink-1', score: 8 })],
		});
		expect(r.summary.covered).toBe(1);
		expect(r.summary.coverageScore).toBe(100);
		expect(r.findings).toHaveLength(0);
	});

	it('marks partial-score Defender control as partial + finding', () => {
		const r = assembleDefenderScan({
			controlProfiles: [profile({ id: 'safelink-2', maxScore: 8 })],
			controlScores: [score({ controlName: 'safelink-2', score: 4, implementationStatus: 'Partial' })],
		});
		expect(r.summary.partial).toBe(1);
		expect(r.findings).toHaveLength(1);
		expect(r.findings[0].severity).toBe('critical'); // maxScore >= 8
	});

	it('marks missing Defender control as missing + critical finding', () => {
		const r = assembleDefenderScan({
			controlProfiles: [profile({ id: 'safeatt', maxScore: 10, title: 'Enable Safe Attachments policy' })],
			controlScores: [score({ controlName: 'safeatt', score: 0, implementationStatus: 'Not Implemented' })],
		});
		expect(r.summary.missing).toBe(1);
		expect(r.findings[0].severity).toBe('critical');
	});

	it('classifies controls into endpoint / office / identity / cloud-apps', () => {
		const r = assembleDefenderScan({
			controlProfiles: [
				profile({ id: 'mde-1', title: 'Onboard devices to Microsoft Defender for Endpoint', service: 'Defender for Endpoint' }),
				profile({ id: 'mdi-1', title: 'Microsoft Defender for Identity', service: 'Defender for Identity' }),
				profile({ id: 'mcas-1', title: 'Defender for Cloud Apps', service: 'Defender for Cloud Apps' }),
				profile({ id: 'safelink-3', title: 'Enable Safe Links', service: 'Defender for Office 365' }),
			],
			controlScores: [
				score({ controlName: 'mde-1', score: 0 }),
				score({ controlName: 'mdi-1', score: 8 }),
				score({ controlName: 'mcas-1', score: 4 }),
				score({ controlName: 'safelink-3', score: 8 }),
			],
		});
		expect(r.summary.byCategory.endpoint.total).toBe(1);
		expect(r.summary.byCategory.identity.total).toBe(1);
		expect(r.summary.byCategory['cloud-apps'].total).toBe(1);
		expect(r.summary.byCategory.office.total).toBe(1);
	});

	it('penalizes posture for criticals', () => {
		const r = assembleDefenderScan({
			controlProfiles: [
				profile({ id: 'a', maxScore: 10 }),
				profile({ id: 'b', maxScore: 10, title: 'Anti-phishing' }),
				profile({ id: 'c', maxScore: 10, title: 'Safe Attachments' }),
			],
			controlScores: [
				score({ controlName: 'a', score: 0, implementationStatus: 'Not Implemented' }),
				score({ controlName: 'b', score: 0, implementationStatus: 'Not Implemented' }),
				score({ controlName: 'c', score: 0, implementationStatus: 'Not Implemented' }),
			],
		});
		expect(r.summary.coverageScore).toBe(0);
		expect(r.summary.postureScore).toBe(0);
		expect(r.findings).toHaveLength(3);
		expect(r.findings.every((f) => f.severity === 'critical')).toBe(true);
	});

	it('falls back to built-in remediation text when profile lacks one', () => {
		const r = assembleDefenderScan({
			controlProfiles: [profile({ id: 'sl-x', title: 'Enable Safe Links policy', remediation: undefined, actionUrl: undefined })],
			controlScores: [score({ controlName: 'sl-x', score: 0 })],
		});
		expect(r.controls[0].remediation).toMatch(/Safe Links/i);
	});
});
