export interface ScanMessage {
	type: string;
	tenantId: string;
	candidates?: Array<{
		ruleId: string;
		title: string;
		description: string;
		businessImpact: string | null;
		affectedResources: unknown[];
		recommendedAction: string | null;
		severity?: string;
		category?: string;
	}>;
	[key: string]: unknown;
}

const SEVERITY_MAP: Record<string, string> = {
	'SEC-001': 'critical', 'SEC-002': 'critical', 'SEC-003': 'critical',
	'SEC-004': 'high', 'SEC-005': 'high', 'SEC-006': 'medium',
	'OPT-001': 'high', 'OPT-002': 'high', 'OPT-003': 'medium',
	'CMP-001': 'medium', 'CMP-002': 'medium', 'CMP-003': 'high',
	'OPS-001': 'high', 'OPS-002': 'medium'
};

export function getSeverityFromRule(ruleId: string): string {
	return SEVERITY_MAP[ruleId] ?? 'medium';
}

export function getCategoryFromRule(ruleId: string): string {
	if (ruleId.startsWith('SEC')) return 'security';
	if (ruleId.startsWith('OPT')) return 'optimization';
	if (ruleId.startsWith('CMP')) return 'compliance';
	return 'operational';
}

export function getRemediationType(ruleId: string): string {
	const automatic = ['OPT-001'];
	const manual = ['SEC-004', 'OPT-003', 'CMP-002', 'OPS-001', 'OPS-002'];
	if (automatic.includes(ruleId)) return 'automatic';
	if (manual.includes(ruleId)) return 'manual';
	return 'semi_automatic';
}
