import { describe, expect, it } from 'vitest';
import { calculatePriorityScore, prioritizeFindings, type PrioritizationInput } from './risk-prioritization';

function baseInput(overrides: Partial<PrioritizationInput> = {}): PrioritizationInput {
	return {
		id: 'risk-1',
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

describe('risk prioritization', () => {
	it('scores critical exploitable findings higher than low-severity findings', () => {
		const critical = calculatePriorityScore(baseInput({
			id: 'critical',
			severity: 'critical',
			exploitability: 'active',
			blastRadius: 0.9,
			complianceImpact: 0.8,
			context: {
				exposedToInternet: true,
				privilegeEscalationPath: true,
				secretsExposure: true,
				lateralMovementPathCount: 3,
				assetCriticality: 0.9,
				controlCoverageGap: 0.8,
			},
		}));

		const low = calculatePriorityScore(baseInput({
			id: 'low',
			severity: 'low',
			exploitability: 'unknown',
			blastRadius: 0.1,
			complianceImpact: 0.1,
		}));

		expect(critical.priorityScore).toBeGreaterThan(low.priorityScore);
		expect(critical.priorityBand).toBe('critical');
		expect(low.priorityBand).toBe('low');
	});

	it('includes rationale for key contextual drivers', () => {
		const scored = calculatePriorityScore(baseInput({
			severity: 'high',
			exploitability: 'active',
			context: {
				exposedToInternet: true,
				privilegeEscalationPath: true,
				secretsExposure: false,
				lateralMovementPathCount: 1,
				assetCriticality: 0.85,
				controlCoverageGap: 0.5,
			},
			complianceImpact: 0.75,
		}));

		expect(scored.rationale).toContain('active exploit activity observed');
		expect(scored.rationale).toContain('internet-exposed attack surface');
		expect(scored.rationale).toContain('privilege escalation path exists');
		expect(scored.rationale).toContain('high compliance impact');
	});

	it('returns findings sorted by descending priority score', () => {
		const sorted = prioritizeFindings([
			baseInput({ id: 'mid', severity: 'medium', blastRadius: 0.5 }),
			baseInput({ id: 'top', severity: 'critical', exploitability: 'active', blastRadius: 1 }),
			baseInput({ id: 'low', severity: 'low', blastRadius: 0.1 }),
		]);

		expect(sorted[0].id).toBe('top');
		expect(sorted[2].id).toBe('low');
	});
});
