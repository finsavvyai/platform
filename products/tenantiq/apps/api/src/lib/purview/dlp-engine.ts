/**
 * DLP Engine — fetches and analyzes Data Loss Prevention policies.
 * Uses Microsoft Graph API when available, provides compliance scoring.
 */

export interface DLPPolicy {
	id: string;
	name: string;
	mode: 'enforce' | 'test' | 'off';
	createdAt: string;
	conditions: string[];
	actions: string[];
}

export interface DLPIncident {
	id: string;
	policyName: string;
	matchedContent: string;
	user: string;
	timestamp: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface DLPComplianceResult {
	score: number;
	enforced: number;
	testMode: number;
	disabled: number;
	recommendations: string[];
}

interface GraphClient {
	fetch(path: string): Promise<any>;
}

/** Fetch DLP policies from Microsoft Graph API */
export async function fetchDLPPolicies(
	graphToken: GraphClient | null,
): Promise<DLPPolicy[]> {
	if (!graphToken) return [];

	try {
		const data = await graphToken.fetch(
			'/security/informationProtection/policy/dlpPolicies',
		);
		const raw = data.value || [];

		return raw.map((p: any) => ({
			id: p.id || crypto.randomUUID(),
			name: p.displayName || 'Unnamed Policy',
			mode: mapPolicyMode(p),
			createdAt: p.createdDateTime || new Date().toISOString(),
			conditions: extractConditions(p),
			actions: extractActions(p),
		}));
	} catch {
		return [];
	}
}

function mapPolicyMode(policy: any): DLPPolicy['mode'] {
	if (policy.isEnabled === false || policy.state === 'disabled') return 'off';
	if (
		policy.mode === 'test' ||
		policy.state === 'enabledForReportingButNotEnforced'
	) {
		return 'test';
	}
	return 'enforce';
}

function extractConditions(policy: any): string[] {
	const conditions: string[] = [];
	if (policy.sensitiveTypeIds?.length) {
		conditions.push(
			`Sensitive types: ${policy.sensitiveTypeIds.length} configured`,
		);
	}
	if (policy.locations?.length) {
		conditions.push(`Locations: ${policy.locations.join(', ')}`);
	}
	if (policy.contentContainsSensitiveInformation) {
		conditions.push('Content sensitivity scanning enabled');
	}
	if (conditions.length === 0) conditions.push('Default conditions');
	return conditions;
}

function extractActions(policy: any): string[] {
	const actions: string[] = [];
	if (policy.actions?.includes('BlockAccess')) actions.push('Block access');
	if (policy.actions?.includes('NotifyUser')) actions.push('Notify user');
	if (policy.actions?.includes('GenerateIncidentReport')) {
		actions.push('Generate incident report');
	}
	if (actions.length === 0) actions.push('Audit only');
	return actions;
}

/** Analyze DLP compliance posture from fetched policies */
export function analyzeDLPCompliance(
	policies: DLPPolicy[],
): DLPComplianceResult {
	const enforced = policies.filter((p) => p.mode === 'enforce').length;
	const testMode = policies.filter((p) => p.mode === 'test').length;
	const disabled = policies.filter((p) => p.mode === 'off').length;

	const recommendations = buildDLPRecommendations(
		policies,
		enforced,
		testMode,
		disabled,
	);

	const score = calculateDLPScore(enforced, testMode, policies.length);

	return { score, enforced, testMode, disabled, recommendations };
}

function calculateDLPScore(
	enforced: number,
	testMode: number,
	total: number,
): number {
	if (total === 0) return 0;
	const points = enforced * 1 + testMode * 0.5;
	return Math.round((points / Math.max(total, 2)) * 100);
}

function buildDLPRecommendations(
	policies: DLPPolicy[],
	enforced: number,
	testMode: number,
	disabled: number,
): string[] {
	const recs: string[] = [];

	if (policies.length === 0) {
		recs.push('Create DLP policies to protect sensitive data');
		recs.push('Start with built-in PII detection templates');
		recs.push('Apply policies to Exchange, SharePoint, and Teams');
		return recs;
	}

	if (enforced === 0) {
		recs.push('Enable enforcement on at least one DLP policy');
	}
	if (testMode > 0) {
		recs.push(
			`Move ${testMode} test-mode policies to enforcement after review`,
		);
	}
	if (disabled > 0) {
		recs.push(
			`Review ${disabled} disabled policies — remove or re-enable them`,
		);
	}
	if (enforced < 2) {
		recs.push(
			'Add a second enforced policy for financial or IP data protection',
		);
	}

	return recs;
}
