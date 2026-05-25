import { describe, expect, it } from 'vitest';
import { generateSuggestedActions } from './ai-suggested-actions';

describe('generateSuggestedActions', () => {
	it('returns CIS scan action for security keywords', () => {
		const actions = generateSuggestedActions(
			'There is a security issue with your tenant. Run a CIS benchmark scan to identify gaps.',
		);
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('Run CIS Scan');
	});

	it('returns license optimization for license waste keyword', () => {
		const actions = generateSuggestedActions(
			'I detected significant license waste in your subscription. Consider optimizing.',
		);
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('Optimize Licenses');
	});

	it('returns enable MFA for mfa keyword', () => {
		const actions = generateSuggestedActions(
			'Several users do not have MFA enabled. This is a critical gap.',
		);
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('Enable MFA');
	});

	it('returns max 3 actions even with many keyword matches', () => {
		const response = [
			'security issue detected',
			'license waste found',
			'MFA not enabled',
			'risky user flagged',
			'backup needed',
			'email threat found',
		].join('. ');
		const actions = generateSuggestedActions(response);
		expect(actions.length).toBeLessThanOrEqual(3);
	});

	it('returns empty for empty response', () => {
		expect(generateSuggestedActions('')).toHaveLength(0);
	});

	it('returns empty for very short response', () => {
		expect(generateSuggestedActions('ok')).toHaveLength(0);
	});

	it('returns empty for unrelated text', () => {
		const actions = generateSuggestedActions(
			'The weather today is sunny and warm with clear skies.',
		);
		expect(actions).toHaveLength(0);
	});

	it('each action has label, type, target, description', () => {
		const actions = generateSuggestedActions('There is a security risk in your tenant.');
		for (const action of actions) {
			expect(action.label).toBeTruthy();
			expect(['navigate', 'remediate', 'scan', 'export']).toContain(action.type);
			expect(action.target).toBeTruthy();
			expect(action.description).toBeTruthy();
		}
	});

	it('does not return duplicate targets', () => {
		const actions = generateSuggestedActions(
			'security issue, security risk, cis benchmark, compliance gap, non-compliant',
		);
		const targets = actions.map((a) => a.target);
		expect(new Set(targets).size).toBe(targets.length);
	});

	it('case insensitive keyword matching', () => {
		const actions = generateSuggestedActions('SECURITY ISSUE detected in TENANT.');
		expect(actions.length).toBeGreaterThan(0);
	});

	it('matches risky user keyword', () => {
		const actions = generateSuggestedActions('A risky user was detected in your organization.');
		const labels = actions.map((a) => a.label);
		expect(labels).toContain('View Risky Users');
	});
});
