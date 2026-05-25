import type { AlertCategory, Severity } from '@tenantiq/shared';

export interface RiskContext {
	exposedToInternet: boolean;
	privilegeEscalationPath: boolean;
	secretsExposure: boolean;
	lateralMovementPathCount: number;
	assetCriticality: number;
	controlCoverageGap: number;
}

export interface PrioritizationInput {
	id: string;
	severity: Severity;
	category: AlertCategory;
	exploitability: 'active' | 'known' | 'unknown';
	complianceImpact: number;
	blastRadius: number;
	context: RiskContext;
}

export interface PrioritizedRisk {
	id: string;
	priorityScore: number;
	priorityBand: 'critical' | 'high' | 'medium' | 'low';
	rationale: string[];
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
	critical: 1.0,
	high: 0.8,
	medium: 0.55,
	low: 0.3,
};

const EXPLOITABILITY_WEIGHT: Record<PrioritizationInput['exploitability'], number> = {
	active: 1.0,
	known: 0.65,
	unknown: 0.3,
};

function clamp01(value: number): number {
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

function toPriorityBand(score: number): PrioritizedRisk['priorityBand'] {
	if (score >= 85) return 'critical';
	if (score >= 70) return 'high';
	if (score >= 45) return 'medium';
	return 'low';
}

function buildRationale(input: PrioritizationInput): string[] {
	const reasons: string[] = [];

	if (input.exploitability === 'active') reasons.push('active exploit activity observed');
	if (input.context.exposedToInternet) reasons.push('internet-exposed attack surface');
	if (input.context.privilegeEscalationPath) reasons.push('privilege escalation path exists');
	if (input.context.secretsExposure) reasons.push('secrets may be exposed');
	if (input.context.lateralMovementPathCount > 0) reasons.push('lateral movement paths detected');
	if (input.complianceImpact >= 0.7) reasons.push('high compliance impact');
	if (input.context.assetCriticality >= 0.75) reasons.push('high-value asset affected');

	if (reasons.length === 0) reasons.push('baseline detection signal');
	return reasons;
}

export function calculatePriorityScore(input: PrioritizationInput): PrioritizedRisk {
	const severityComponent = SEVERITY_WEIGHT[input.severity] * 30;
	const exploitabilityComponent = EXPLOITABILITY_WEIGHT[input.exploitability] * 20;
	const blastRadiusComponent = clamp01(input.blastRadius) * 15;
	const assetCriticalityComponent = clamp01(input.context.assetCriticality) * 10;
	const controlGapComponent = clamp01(input.context.controlCoverageGap) * 10;
	const complianceComponent = clamp01(input.complianceImpact) * 10;

	let contextualComponent = 0;
	if (input.context.exposedToInternet) contextualComponent += 3;
	if (input.context.privilegeEscalationPath) contextualComponent += 3;
	if (input.context.secretsExposure) contextualComponent += 2;
	contextualComponent += Math.min(input.context.lateralMovementPathCount, 4);

	const rawScore =
		severityComponent +
		exploitabilityComponent +
		blastRadiusComponent +
		assetCriticalityComponent +
		controlGapComponent +
		complianceComponent +
		contextualComponent;

	const priorityScore = Math.round(Math.min(100, rawScore));
	return {
		id: input.id,
		priorityScore,
		priorityBand: toPriorityBand(priorityScore),
		rationale: buildRationale(input),
	};
}

export function prioritizeFindings(inputs: PrioritizationInput[]): PrioritizedRisk[] {
	return inputs
		.map(calculatePriorityScore)
		.sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id));
}
