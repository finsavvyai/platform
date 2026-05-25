/**
 * Credential Rotation Completeness Verifier
 *
 * Generates complete rotation checklist when breach declared.
 * Verifies each secret/token was actually revoked.
 * Tracks rotation timestamps — flags if > 5 minutes between rotations.
 * Checks audit logs for old token activity post-rotation.
 */

export interface CredentialEntry {
	id: string;
	type: 'app_secret' | 'certificate' | 'api_key' | 'service_account' | 'user_password' | 'token';
	name: string;
	owner: string;
	lastRotated: string | null;
	expiresAt: string | null;
}

export interface RotationChecklistItem {
	credentialId: string;
	credentialName: string;
	credentialType: string;
	status: 'pending' | 'rotated' | 'verified' | 'failed' | 'stale_usage';
	rotatedAt: string | null;
	verifiedAt: string | null;
	timeSinceBreachMs: number | null;
	gapFromPreviousMs: number | null;
	oldTokenActivity: OldTokenActivity[];
}

export interface OldTokenActivity {
	timestamp: string;
	action: string;
	ipAddress: string;
	userAgent: string;
}

export interface RotationReport {
	breachDeclaredAt: string;
	totalCredentials: number;
	rotatedCount: number;
	verifiedCount: number;
	pendingCount: number;
	failedCount: number;
	staleUsageCount: number;
	maxRotationGapMs: number;
	completionPercent: number;
	checklist: RotationChecklistItem[];
	warnings: string[];
}

const ROTATION_GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function generateRotationChecklist(
	credentials: CredentialEntry[],
	breachDeclaredAt: Date
): RotationChecklistItem[] {
	return credentials.map((cred) => ({
		credentialId: cred.id,
		credentialName: cred.name,
		credentialType: cred.type,
		status: 'pending' as const,
		rotatedAt: null,
		verifiedAt: null,
		timeSinceBreachMs: null,
		gapFromPreviousMs: null,
		oldTokenActivity: [],
	}));
}

export function updateChecklistWithRotation(
	checklist: RotationChecklistItem[],
	credentialId: string,
	rotatedAt: Date,
	breachDeclaredAt: Date
): RotationChecklistItem[] {
	return checklist.map((item) => {
		if (item.credentialId !== credentialId) return item;
		return {
			...item,
			status: 'rotated' as const,
			rotatedAt: rotatedAt.toISOString(),
			timeSinceBreachMs: rotatedAt.getTime() - breachDeclaredAt.getTime(),
		};
	});
}

export function verifyRotationCompleteness(
	checklist: RotationChecklistItem[],
	auditLogs: Array<{ credentialId: string; activities: OldTokenActivity[] }>
): RotationChecklistItem[] {
	const activityMap = new Map(auditLogs.map((a) => [a.credentialId, a.activities]));

	return checklist.map((item) => {
		const activities = activityMap.get(item.credentialId) || [];
		if (activities.length > 0 && item.rotatedAt) {
			const postRotation = activities.filter(
				(a) => new Date(a.timestamp).getTime() > new Date(item.rotatedAt!).getTime()
			);
			if (postRotation.length > 0) {
				return { ...item, status: 'stale_usage' as const, oldTokenActivity: postRotation };
			}
		}
		if (item.status === 'rotated') {
			return { ...item, status: 'verified' as const, verifiedAt: new Date().toISOString() };
		}
		return item;
	});
}

export function calculateRotationGaps(
	checklist: RotationChecklistItem[]
): RotationChecklistItem[] {
	const rotated = checklist
		.filter((i) => i.rotatedAt)
		.sort((a, b) => new Date(a.rotatedAt!).getTime() - new Date(b.rotatedAt!).getTime());

	return checklist.map((item) => {
		if (!item.rotatedAt) return item;
		const idx = rotated.findIndex((r) => r.credentialId === item.credentialId);
		if (idx <= 0) return item;
		const gap = new Date(item.rotatedAt).getTime() - new Date(rotated[idx - 1].rotatedAt!).getTime();
		return { ...item, gapFromPreviousMs: gap };
	});
}

export function buildRotationReport(
	checklist: RotationChecklistItem[],
	breachDeclaredAt: Date
): RotationReport {
	const withGaps = calculateRotationGaps(checklist);
	const warnings: string[] = [];

	const rotatedCount = withGaps.filter((i) => i.status === 'rotated' || i.status === 'verified').length;
	const verifiedCount = withGaps.filter((i) => i.status === 'verified').length;
	const pendingCount = withGaps.filter((i) => i.status === 'pending').length;
	const failedCount = withGaps.filter((i) => i.status === 'failed').length;
	const staleUsageCount = withGaps.filter((i) => i.status === 'stale_usage').length;

	const maxGap = Math.max(0, ...withGaps.map((i) => i.gapFromPreviousMs ?? 0));
	if (maxGap > ROTATION_GAP_THRESHOLD_MS) {
		warnings.push(`Max rotation gap: ${Math.round(maxGap / 60000)}min (exceeds 5min threshold)`);
	}
	if (staleUsageCount > 0) {
		warnings.push(`${staleUsageCount} credential(s) show old token activity post-rotation`);
	}
	if (pendingCount > 0) {
		warnings.push(`${pendingCount} credential(s) still pending rotation`);
	}

	return {
		breachDeclaredAt: breachDeclaredAt.toISOString(),
		totalCredentials: withGaps.length,
		rotatedCount,
		verifiedCount,
		pendingCount,
		failedCount,
		staleUsageCount,
		maxRotationGapMs: maxGap,
		completionPercent: withGaps.length > 0 ? Math.round((rotatedCount / withGaps.length) * 100) : 100,
		checklist: withGaps,
		warnings,
	};
}
