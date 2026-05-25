/**
 * Sample Project 9: Risk Prioritization Engine
 *
 * Simulates: Scoring and ranking security findings across different
 * threat profiles — from actively exploited critical vulnerabilities
 * to low-risk informational findings. Tests the priority scoring
 * algorithm with realistic MSP customer scenarios.
 */
import { describe, it, expect } from 'vitest';
import {
	calculatePriorityScore,
	prioritizeFindings,
	type PrioritizationInput,
} from '../../packages/intel/src/risk-prioritization';

// ── Scenario builders ────────────────────────────────────────────

function baseInput(overrides: Partial<PrioritizationInput> = {}): PrioritizationInput {
	return {
		id: 'finding-base',
		severity: 'medium',
		category: 'security',
		exploitability: 'unknown',
		complianceImpact: 0.2,
		blastRadius: 0.2,
		context: {
			exposedToInternet: false,
			privilegeEscalationPath: false,
			secretsExposure: false,
			lateralMovementPathCount: 0,
			assetCriticality: 0.3,
			controlCoverageGap: 0.2,
		},
		...overrides,
	};
}

describe('Risk Prioritization — Threat Scenario Coverage', () => {
	describe('Scenario 1: Active Ransomware Attack Vector', () => {
		const finding = baseInput({
			id: 'ransomware-vector',
			severity: 'critical',
			category: 'security',
			exploitability: 'active',
			complianceImpact: 0.95,
			blastRadius: 1.0,
			context: {
				exposedToInternet: true,
				privilegeEscalationPath: true,
				secretsExposure: true,
				lateralMovementPathCount: 5,
				assetCriticality: 1.0,
				controlCoverageGap: 0.9,
			},
		});

		it('should score in critical band (85+)', () => {
			const result = calculatePriorityScore(finding);
			expect(result.priorityBand).toBe('critical');
			expect(result.priorityScore).toBeGreaterThanOrEqual(85);
		});

		it('should have comprehensive rationale', () => {
			const result = calculatePriorityScore(finding);
			expect(result.rationale).toContain('active exploit activity observed');
			expect(result.rationale).toContain('internet-exposed attack surface');
			expect(result.rationale).toContain('privilege escalation path exists');
			expect(result.rationale).toContain('secrets may be exposed');
			expect(result.rationale).toContain('lateral movement paths detected');
			expect(result.rationale).toContain('high compliance impact');
			expect(result.rationale).toContain('high-value asset affected');
		});

		it('should score near maximum (90+)', () => {
			const result = calculatePriorityScore(finding);
			expect(result.priorityScore).toBeGreaterThanOrEqual(90);
		});
	});

	describe('Scenario 2: Credential Stuffing (Known Exploit)', () => {
		const finding = baseInput({
			id: 'credential-stuffing',
			severity: 'high',
			category: 'security',
			exploitability: 'known',
			complianceImpact: 0.6,
			blastRadius: 0.5,
			context: {
				exposedToInternet: true,
				privilegeEscalationPath: false,
				secretsExposure: false,
				lateralMovementPathCount: 0,
				assetCriticality: 0.7,
				controlCoverageGap: 0.4,
			},
		});

		it('should score higher than low-severity findings', () => {
			const result = calculatePriorityScore(finding);
			const lowResult = calculatePriorityScore(baseInput({
				id: 'low-ref', severity: 'low', exploitability: 'unknown',
				blastRadius: 0.1, complianceImpact: 0.1,
			}));
			expect(result.priorityScore).toBeGreaterThan(lowResult.priorityScore);
		});

		it('should mention internet exposure in rationale', () => {
			const result = calculatePriorityScore(finding);
			expect(result.rationale).toContain('internet-exposed attack surface');
		});
	});

	describe('Scenario 3: Misconfigured Sharing Policy (Compliance)', () => {
		const finding = baseInput({
			id: 'oversharing-policy',
			severity: 'medium',
			category: 'compliance',
			exploitability: 'unknown',
			complianceImpact: 0.75,
			blastRadius: 0.3,
			context: {
				exposedToInternet: false,
				privilegeEscalationPath: false,
				secretsExposure: false,
				lateralMovementPathCount: 0,
				assetCriticality: 0.5,
				controlCoverageGap: 0.3,
			},
		});

		it('should score higher than informational finding', () => {
			const result = calculatePriorityScore(finding);
			const infoResult = calculatePriorityScore(baseInput({
				id: 'info-ref', severity: 'low', exploitability: 'unknown',
				blastRadius: 0.05, complianceImpact: 0.05,
				context: {
					exposedToInternet: false, privilegeEscalationPath: false,
					secretsExposure: false, lateralMovementPathCount: 0,
					assetCriticality: 0.1, controlCoverageGap: 0.1,
				},
			}));
			expect(result.priorityScore).toBeGreaterThan(infoResult.priorityScore);
		});

		it('should note compliance impact', () => {
			const result = calculatePriorityScore(finding);
			expect(result.rationale).toContain('high compliance impact');
		});
	});

	describe('Scenario 4: Informational Finding (Low Risk)', () => {
		const finding = baseInput({
			id: 'info-finding',
			severity: 'low',
			category: 'operational',
			exploitability: 'unknown',
			complianceImpact: 0.05,
			blastRadius: 0.05,
			context: {
				exposedToInternet: false,
				privilegeEscalationPath: false,
				secretsExposure: false,
				lateralMovementPathCount: 0,
				assetCriticality: 0.1,
				controlCoverageGap: 0.1,
			},
		});

		it('should score in low band (<45)', () => {
			const result = calculatePriorityScore(finding);
			expect(result.priorityBand).toBe('low');
			expect(result.priorityScore).toBeLessThan(45);
		});

		it('should have baseline rationale only', () => {
			const result = calculatePriorityScore(finding);
			expect(result.rationale).toContain('baseline detection signal');
		});
	});

	describe('Scenario 5: Privilege Escalation with Lateral Movement', () => {
		const finding = baseInput({
			id: 'priv-esc-lateral',
			severity: 'critical',
			category: 'security',
			exploitability: 'known',
			complianceImpact: 0.8,
			blastRadius: 0.7,
			context: {
				exposedToInternet: false,
				privilegeEscalationPath: true,
				secretsExposure: true,
				lateralMovementPathCount: 3,
				assetCriticality: 0.85,
				controlCoverageGap: 0.6,
			},
		});

		it('should score in critical or high band', () => {
			const result = calculatePriorityScore(finding);
			expect(['critical', 'high']).toContain(result.priorityBand);
		});

		it('should mention privilege escalation and lateral movement', () => {
			const result = calculatePriorityScore(finding);
			expect(result.rationale).toContain('privilege escalation path exists');
			expect(result.rationale).toContain('lateral movement paths detected');
		});
	});

	describe('Multi-Finding Prioritization (MSP Dashboard)', () => {
		const findings: PrioritizationInput[] = [
			baseInput({
				id: 'tenant-a-critical', severity: 'critical',
				exploitability: 'active', blastRadius: 0.9,
				complianceImpact: 0.9,
				context: {
					exposedToInternet: true, privilegeEscalationPath: true,
					secretsExposure: true, lateralMovementPathCount: 4,
					assetCriticality: 0.95, controlCoverageGap: 0.8,
				},
			}),
			baseInput({
				id: 'tenant-b-high', severity: 'high',
				exploitability: 'known', blastRadius: 0.5,
				complianceImpact: 0.6,
				context: {
					exposedToInternet: true, privilegeEscalationPath: false,
					secretsExposure: false, lateralMovementPathCount: 0,
					assetCriticality: 0.5, controlCoverageGap: 0.3,
				},
			}),
			baseInput({
				id: 'tenant-c-medium', severity: 'medium',
				exploitability: 'unknown', blastRadius: 0.3,
				complianceImpact: 0.2,
			}),
			baseInput({
				id: 'tenant-d-low', severity: 'low',
				exploitability: 'unknown', blastRadius: 0.1,
				complianceImpact: 0.1,
			}),
			baseInput({
				id: 'tenant-e-compliance', severity: 'medium',
				category: 'compliance', exploitability: 'unknown',
				complianceImpact: 0.85, blastRadius: 0.4,
				context: {
					exposedToInternet: false, privilegeEscalationPath: false,
					secretsExposure: false, lateralMovementPathCount: 0,
					assetCriticality: 0.6, controlCoverageGap: 0.5,
				},
			}),
		];

		it('should sort findings by descending priority score', () => {
			const sorted = prioritizeFindings(findings);
			for (let i = 1; i < sorted.length; i++) {
				expect(sorted[i - 1].priorityScore).toBeGreaterThanOrEqual(sorted[i].priorityScore);
			}
		});

		it('critical+active finding should rank first', () => {
			const sorted = prioritizeFindings(findings);
			expect(sorted[0].id).toBe('tenant-a-critical');
		});

		it('low-severity finding should rank last', () => {
			const sorted = prioritizeFindings(findings);
			expect(sorted[sorted.length - 1].id).toBe('tenant-d-low');
		});

		it('should assign distinct priority bands', () => {
			const sorted = prioritizeFindings(findings);
			const bands = new Set(sorted.map((r) => r.priorityBand));
			expect(bands.size).toBeGreaterThanOrEqual(3); // at least 3 different bands
		});

		it('each finding should have a unique ID', () => {
			const sorted = prioritizeFindings(findings);
			const ids = sorted.map((r) => r.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe('Score Component Boundaries', () => {
		it('maximum possible score should not exceed 100', () => {
			const maxInput = baseInput({
				id: 'max',
				severity: 'critical',
				exploitability: 'active',
				blastRadius: 1.0,
				complianceImpact: 1.0,
				context: {
					exposedToInternet: true,
					privilegeEscalationPath: true,
					secretsExposure: true,
					lateralMovementPathCount: 100, // extreme
					assetCriticality: 1.0,
					controlCoverageGap: 1.0,
				},
			});
			const result = calculatePriorityScore(maxInput);
			expect(result.priorityScore).toBeLessThanOrEqual(100);
		});

		it('minimum possible score should be >= 0', () => {
			const minInput = baseInput({
				id: 'min',
				severity: 'low',
				exploitability: 'unknown',
				blastRadius: 0,
				complianceImpact: 0,
				context: {
					exposedToInternet: false,
					privilegeEscalationPath: false,
					secretsExposure: false,
					lateralMovementPathCount: 0,
					assetCriticality: 0,
					controlCoverageGap: 0,
				},
			});
			const result = calculatePriorityScore(minInput);
			expect(result.priorityScore).toBeGreaterThanOrEqual(0);
		});

		it('values > 1.0 should be clamped', () => {
			const clampInput = baseInput({
				id: 'clamped',
				blastRadius: 5.0, // way over 1.0
				complianceImpact: 10.0,
				context: {
					exposedToInternet: false,
					privilegeEscalationPath: false,
					secretsExposure: false,
					lateralMovementPathCount: 0,
					assetCriticality: 999,
					controlCoverageGap: 999,
				},
			});
			const result = calculatePriorityScore(clampInput);
			expect(result.priorityScore).toBeLessThanOrEqual(100);
		});
	});
});
