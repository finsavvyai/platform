/**
 * AI Prompt Guard for M365 Copilot
 *
 * Monitors Copilot audit logs for unusual data access.
 * Flags unusual combinations of sensitivity levels.
 * Detects prompt injection patterns.
 * Provides "Copilot Security Posture" for CIS assessment.
 */

export interface CopilotAuditEntry {
	userId: string;
	userDisplayName: string;
	timestamp: string;
	operation: string;
	application: string;
	promptText?: string;
	accessedResources: CopilotAccessedResource[];
}

export interface CopilotAccessedResource {
	resourceType: 'file' | 'email' | 'chat' | 'site';
	sensitivityLabel: string | null;
	path: string;
}

export interface PromptGuardFinding {
	type: 'injection_pattern' | 'sensitivity_escalation' | 'bulk_access' | 'cross_boundary';
	severity: 'critical' | 'high' | 'medium';
	userId: string;
	userDisplayName: string;
	timestamp: string;
	detail: string;
	evidence: string[];
	recommendedAction: string;
}

export interface CopilotSecurityPosture {
	overallScore: number;
	dimensions: {
		dlpCoverage: number;
		sensitivityLabeling: number;
		accessControls: number;
		auditLogging: number;
		promptSafety: number;
	};
	findings: PromptGuardFinding[];
	totalEventsAnalyzed: number;
	scannedAt: string;
}

const INJECTION_PATTERNS = [
	/ignore\s+(previous|above|all)\s+(instructions|rules|constraints)/i,
	/you\s+are\s+now\s+(a|an|in)\s+/i,
	/system\s*prompt|bypass\s+filter/i,
	/pretend\s+(you|to)\s+(are|be|have)/i,
	/do\s+not\s+follow\s+(any|the)\s+(rules|guidelines)/i,
	/jailbreak|DAN\s+mode|developer\s+mode/i,
	/output\s+(all|every)\s+(file|document|email|secret)/i,
	/list\s+all\s+(passwords|credentials|secrets|tokens)/i,
];

const SENSITIVITY_LEVELS = ['Public', 'Internal', 'Confidential', 'Highly Confidential'];

function getSensitivityRank(label: string | null): number {
	if (!label) return 0;
	const idx = SENSITIVITY_LEVELS.findIndex((l) => l.toLowerCase() === label.toLowerCase());
	return idx >= 0 ? idx : 0;
}

export function detectPromptInjection(entry: CopilotAuditEntry): PromptGuardFinding | null {
	if (!entry.promptText) return null;

	const matched = INJECTION_PATTERNS.filter((p) => p.test(entry.promptText!));
	if (matched.length === 0) return null;

	return {
		type: 'injection_pattern',
		severity: 'critical',
		userId: entry.userId,
		userDisplayName: entry.userDisplayName,
		timestamp: entry.timestamp,
		detail: `Prompt injection pattern detected in Copilot interaction`,
		evidence: matched.map((p) => p.source),
		recommendedAction: 'Review user activity and consider restricting Copilot access',
	};
}

export function detectSensitivityEscalation(entry: CopilotAuditEntry): PromptGuardFinding | null {
	const labels = entry.accessedResources
		.map((r) => r.sensitivityLabel)
		.filter(Boolean) as string[];

	if (labels.length < 2) return null;

	const ranks = labels.map(getSensitivityRank);
	const maxRank = Math.max(...ranks);
	const minRank = Math.min(...ranks);

	if (maxRank - minRank >= 2) {
		return {
			type: 'sensitivity_escalation',
			severity: 'high',
			userId: entry.userId,
			userDisplayName: entry.userDisplayName,
			timestamp: entry.timestamp,
			detail: `Copilot accessed resources spanning ${SENSITIVITY_LEVELS[minRank]} to ${SENSITIVITY_LEVELS[maxRank]}`,
			evidence: labels,
			recommendedAction: 'Review if user should access resources across sensitivity levels',
		};
	}
	return null;
}

export function detectBulkAccess(
	entries: CopilotAuditEntry[],
	windowMinutes: number = 5,
	threshold: number = 20
): PromptGuardFinding[] {
	const findings: PromptGuardFinding[] = [];
	const byUser = new Map<string, CopilotAuditEntry[]>();

	for (const e of entries) {
		const list = byUser.get(e.userId) || [];
		list.push(e);
		byUser.set(e.userId, list);
	}

	for (const [userId, userEntries] of byUser) {
		const sorted = userEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		for (let i = 0; i < sorted.length; i++) {
			const windowEnd = new Date(sorted[i].timestamp).getTime() + windowMinutes * 60_000;
			const inWindow = sorted.filter((e) => {
				const t = new Date(e.timestamp).getTime();
				return t >= new Date(sorted[i].timestamp).getTime() && t <= windowEnd;
			});

			const totalResources = inWindow.reduce((s, e) => s + e.accessedResources.length, 0);
			if (totalResources >= threshold) {
				findings.push({
					type: 'bulk_access',
					severity: 'high',
					userId,
					userDisplayName: sorted[i].userDisplayName,
					timestamp: sorted[i].timestamp,
					detail: `${totalResources} resources accessed via Copilot in ${windowMinutes}min window`,
					evidence: [`${inWindow.length} operations`, `${totalResources} resources`],
					recommendedAction: 'Investigate potential data exfiltration via Copilot',
				});
				break; // one finding per user
			}
		}
	}

	return findings;
}

export function buildCopilotSecurityPosture(
	entries: CopilotAuditEntry[],
	hasDlpPolicies: boolean,
	hasLabels: boolean,
	hasConditionalAccess: boolean,
	hasAuditEnabled: boolean
): CopilotSecurityPosture {
	const findings: PromptGuardFinding[] = [];

	for (const entry of entries) {
		const injection = detectPromptInjection(entry);
		if (injection) findings.push(injection);
		const escalation = detectSensitivityEscalation(entry);
		if (escalation) findings.push(escalation);
	}

	findings.push(...detectBulkAccess(entries));

	const dlpCoverage = hasDlpPolicies ? 100 : 0;
	const sensitivityLabeling = hasLabels ? 100 : 0;
	const accessControls = hasConditionalAccess ? 100 : 0;
	const auditLogging = hasAuditEnabled ? 100 : 0;
	const promptSafety = findings.length === 0 ? 100 : Math.max(0, 100 - findings.length * 20);

	const overallScore = Math.round(
		(dlpCoverage * 0.25 + sensitivityLabeling * 0.2 + accessControls * 0.2
			+ auditLogging * 0.15 + promptSafety * 0.2)
	);

	return {
		overallScore,
		dimensions: { dlpCoverage, sensitivityLabeling, accessControls, auditLogging, promptSafety },
		findings,
		totalEventsAnalyzed: entries.length,
		scannedAt: new Date().toISOString(),
	};
}
