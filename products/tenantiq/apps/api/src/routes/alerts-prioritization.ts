import { prioritizeFindings, type PrioritizationInput, type PrioritizedRisk } from '@tenantiq/intel';
import { schema } from '../lib/db';

type AlertRow = typeof schema.alerts.$inferSelect;
type Severity = PrioritizationInput['severity'];
type Category = PrioritizationInput['category'];

export type PrioritizedAlert = AlertRow & {
	priorityScore: number;
	priorityBand: PrioritizedRisk['priorityBand'];
	priorityRationale: string[];
};

export function shouldPrioritize(queryValue: string | undefined): boolean {
	if (!queryValue) return false;
	const normalized = queryValue.trim().toLowerCase();
	return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function parseMetadata(metadata: string | null): Record<string, unknown> {
	if (!metadata) return {};
	try {
		const parsed = JSON.parse(metadata) as unknown;
		if (parsed && typeof parsed === 'object') {
			return parsed as Record<string, unknown>;
		}
	} catch {
		return {};
	}
	return {};
}

function getNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function getBoolean(value: unknown): boolean | null {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') return true;
		if (normalized === 'false') return false;
	}
	return null;
}

function normalizeSeverity(severity: string): Severity {
	if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
		return severity;
	}
	return 'medium';
}

function normalizeCategory(type: string): Category {
	if (type === 'security' || type === 'optimization' || type === 'compliance' || type === 'operational') {
		return type;
	}
	return 'operational';
}

function toPrioritizationInput(alert: AlertRow): PrioritizationInput {
	const metadata = parseMetadata(alert.metadata);
	const category = normalizeCategory(alert.type);
	const severity = normalizeSeverity(alert.severity);
	const explicitExploitability = metadata.exploitability;
	const activeExploit = getBoolean(metadata.activeExploit) === true;

	const exploitability: PrioritizationInput['exploitability'] =
		explicitExploitability === 'active' || activeExploit
			? 'active'
			: explicitExploitability === 'known' || category === 'security' || category === 'compliance'
				? 'known'
				: 'unknown';

	const blastRadiusFromUsers = typeof alert.affectedUsers === 'number'
		? Math.min(1, Math.max(0, alert.affectedUsers / 100))
		: 0;
	const blastRadius = getNumber(metadata.blastRadius) ?? blastRadiusFromUsers;
	const complianceImpact = getNumber(metadata.complianceImpact)
		?? (category === 'compliance' ? 0.8 : severity === 'critical' ? 0.65 : 0.25);
	const assetCriticality = alert.estimatedRiskScore !== null && alert.estimatedRiskScore !== undefined
		? Math.min(1, Math.max(0, alert.estimatedRiskScore / 100))
		: (severity === 'critical' ? 0.9 : severity === 'high' ? 0.75 : severity === 'medium' ? 0.5 : 0.3);
	const controlCoverageGap = getNumber(metadata.controlCoverageGap)
		?? (alert.canAutoRemediate ? 0.35 : 0.55);
	const lateralMovementPathCount = getNumber(metadata.lateralMovementPathCount) ?? 0;

	return {
		id: alert.id,
		severity,
		category,
		exploitability,
		complianceImpact,
		blastRadius,
		context: {
			exposedToInternet: getBoolean(metadata.exposedToInternet) === true,
			privilegeEscalationPath: getBoolean(metadata.privilegeEscalationPath) === true,
			secretsExposure: getBoolean(metadata.secretsExposure) === true,
			lateralMovementPathCount,
			assetCriticality,
			controlCoverageGap,
		},
	};
}

export function applyAlertPrioritization(alerts: AlertRow[]): PrioritizedAlert[] {
	const prioritized = prioritizeFindings(alerts.map(toPrioritizationInput));
	const priorityById = new Map<string, PrioritizedRisk>(prioritized.map((item) => [item.id, item]));

	return alerts
		.map((alert) => {
			const score = priorityById.get(alert.id);
			return {
				...alert,
				priorityScore: score?.priorityScore ?? 0,
				priorityBand: score?.priorityBand ?? 'low',
				priorityRationale: score?.rationale ?? ['baseline detection signal'],
			};
		})
		.sort((a, b) => b.priorityScore - a.priorityScore || b.createdAt.localeCompare(a.createdAt));
}
