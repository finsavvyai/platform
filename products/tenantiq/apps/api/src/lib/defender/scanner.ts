/**
 * Defender for Office/Endpoint/Identity coverage scanner.
 *
 * Microsoft doesn't expose every ATP policy in Graph v1.0 (Safe Links etc.
 * live in Exchange Online), but Secure Score control profiles map every
 * Defender-relevant control to a current/max score. We treat that as the
 * canonical "is this control in place?" signal and surface the Microsoft
 * portal action URLs for one-click remediation.
 *
 * Inputs: secureScore controlScores[] + controlProfiles[] (raw Graph shapes).
 * Pure: no I/O.
 */

import type {
	DefenderControl,
	DefenderControlCategory,
	DefenderControlStatus,
	DefenderFinding,
	DefenderScanResult,
	DefenderSummary,
} from './types';

export type {
	DefenderControl, DefenderFinding, DefenderScanResult, DefenderSummary,
	DefenderControlCategory, DefenderControlStatus, DefenderFindingSeverity,
} from './types';

export interface RawSecureScoreControlProfile {
	id: string;
	title?: string;
	controlCategory?: string;
	service?: string;
	maxScore?: number;
	actionUrl?: string;
	remediation?: string;
	tier?: string;
	rank?: number;
	implementationCost?: string;
	userImpact?: string;
}

export interface RawSecureScoreControl {
	controlName?: string;
	score?: number;
	implementationStatus?: string;
	scoreInPercentage?: number;
	count?: number;
	total?: number;
	on?: boolean;
	lastSynced?: string;
}

const DEFENDER_TOKENS = [
	'defender', 'safeattach', 'safelink', 'antiphish', 'antimalware', 'atp',
	'mip', 'auditlog', 'eop', 'mailbox audit', 'malware', 'phishing',
	'externalemail', 'spoof', 'mta-sts', 'office 365', 'exchange',
];

export function assembleDefenderScan(input: {
	controlProfiles: RawSecureScoreControlProfile[];
	controlScores: RawSecureScoreControl[];
}): DefenderScanResult {
	const profileMap = new Map<string, RawSecureScoreControlProfile>(
		input.controlProfiles.map((p) => [p.id, p]),
	);

	// Build joined list — only Defender-relevant controls
	const controls: DefenderControl[] = [];
	for (const score of input.controlScores) {
		const profile = score.controlName ? profileMap.get(score.controlName) : undefined;
		const title = profile?.title ?? score.controlName ?? '(unknown control)';
		if (!isDefenderRelevant(title, profile?.service, profile?.controlCategory)) continue;
		const status = mapStatus(score.implementationStatus, score.score, profile?.maxScore);
		controls.push({
			id: profile?.id ?? score.controlName ?? title,
			displayName: title,
			category: classifyCategory(title, profile?.service),
			currentScore: score.score ?? 0,
			maxScore: profile?.maxScore ?? 0,
			implementationStatus: score.implementationStatus ?? 'unknown',
			status,
			actionUrl: profile?.actionUrl ?? null,
			remediation: profile?.remediation ?? buildRemediation(title, profile?.service),
		});
	}

	const findings = buildFindings(controls);
	const summary = buildSummary(controls, findings);
	return {
		scannedAt: new Date().toISOString(),
		summary,
		findings,
		controls,
	};
}

function isDefenderRelevant(title: string, service?: string, category?: string): boolean {
	const raw = `${title} ${service ?? ''} ${category ?? ''}`.toLowerCase();
	const compact = raw.replace(/\s+/g, '');
	return DEFENDER_TOKENS.some((t) => raw.includes(t) || compact.includes(t));
}

function classifyCategory(title: string, service?: string): DefenderControlCategory {
	const t = `${title} ${service ?? ''}`.toLowerCase();
	if (t.includes('endpoint') || t.includes('mde') || t.includes('antivirus') || t.includes('windows')) return 'endpoint';
	if (t.includes('identity') || t.includes('mdi') || t.includes('aad') || t.includes('entra')) return 'identity';
	if (t.includes('cloud app') || t.includes('mcas') || t.includes('mcas')) return 'cloud-apps';
	if (t.includes('office') || t.includes('exchange') || t.includes('safeattach') || t.includes('safelink') || t.includes('antiphish') || t.includes('mailbox') || t.includes('eop')) return 'office';
	return 'general';
}

function mapStatus(impl?: string, score?: number, maxScore?: number): DefenderControlStatus {
	const s = (impl ?? '').toLowerCase();
	if (s.includes('not applicable') || s.includes('reviewed')) return 'not-applicable';
	if (!maxScore || maxScore === 0) return 'not-applicable';
	const ratio = (score ?? 0) / maxScore;
	if (ratio >= 0.99) return 'covered';
	if (ratio > 0) return 'partial';
	if (s.includes('not implemented') || s.includes('non-compliant')) return 'missing';
	if (s.includes('implemented') || s.includes('compliant')) return 'covered';
	return 'missing';
}

function buildFindings(controls: DefenderControl[]): DefenderFinding[] {
	const out: DefenderFinding[] = [];
	for (const c of controls) {
		if (c.status === 'covered' || c.status === 'not-applicable') continue;
		const severity = c.maxScore >= 8 ? 'critical' : c.maxScore >= 4 ? 'high' : 'medium';
		out.push({
			id: `DEF-${c.category.toUpperCase()}-${c.id}`,
			severity,
			category: c.category,
			title: c.displayName,
			detail: `Defender control reports ${c.status} (current ${c.currentScore}/${c.maxScore} Secure Score points). ${c.implementationStatus}`,
			remediation: c.remediation,
			controlId: c.id,
			currentScore: c.currentScore,
			maxScore: c.maxScore,
		});
	}
	out.sort((a, b) => (b.maxScore - b.currentScore) - (a.maxScore - a.currentScore));
	return out;
}

function buildSummary(controls: DefenderControl[], findings: DefenderFinding[]): DefenderSummary {
	const cats: DefenderControlCategory[] = ['office', 'endpoint', 'identity', 'cloud-apps', 'general'];
	const byCategory = Object.fromEntries(
		cats.map((c) => [c, { covered: 0, total: 0, scoreEarned: 0, scoreMax: 0 }]),
	) as DefenderSummary['byCategory'];

	let scoreEarned = 0; let scoreMax = 0;
	for (const c of controls) {
		const bucket = byCategory[c.category];
		bucket.total++;
		if (c.status === 'covered') bucket.covered++;
		bucket.scoreEarned += c.currentScore;
		bucket.scoreMax += c.maxScore;
		scoreEarned += c.currentScore;
		scoreMax += c.maxScore;
	}

	const coverageScore = scoreMax === 0 ? 0 : Math.round((scoreEarned / scoreMax) * 100);
	const critical = findings.filter((f) => f.severity === 'critical').length;
	const high = findings.filter((f) => f.severity === 'high').length;
	const postureScore = Math.max(0, Math.min(100, coverageScore - critical * 5 - high * 2));

	return {
		totalControls: controls.length,
		covered: controls.filter((c) => c.status === 'covered').length,
		partial: controls.filter((c) => c.status === 'partial').length,
		missing: controls.filter((c) => c.status === 'missing').length,
		notApplicable: controls.filter((c) => c.status === 'not-applicable').length,
		byCategory,
		totalScoreEarned: scoreEarned,
		totalScoreMax: scoreMax,
		coverageScore,
		postureScore,
	};
}

function buildRemediation(title: string, service?: string): string {
	const raw = `${title} ${service ?? ''}`.toLowerCase();
	const t = raw.replace(/\s+/g, '');
	if (t.includes('safelink')) return 'Microsoft 365 Defender → Email & collaboration → Policies & rules → Threat policies → Safe Links → enable for all users.';
	if (t.includes('safeattach')) return 'Microsoft 365 Defender → Threat policies → Safe Attachments → set Action = Block, deliver to recipients with attachments stripped.';
	if (t.includes('antiphish')) return 'Microsoft 365 Defender → Threat policies → Anti-phishing → enable spoof intelligence + impersonation protection.';
	if (t.includes('endpoint') || t.includes('mde')) return 'Microsoft 365 Defender → Endpoints → Onboarding → enroll devices via Intune.';
	if (raw.includes('mailbox audit')) return 'Exchange Admin Center → enable mailbox audit logging tenant-wide (already default for new tenants).';
	return 'Open the linked Microsoft action URL on the control card.';
}
