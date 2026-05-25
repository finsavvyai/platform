/**
 * Threat aggregation helpers — map Graph risk detections, parse DB alerts,
 * group duplicates by title, and collapse occurrence dates to distinct days.
 */
import { suggestActions, type ThreatAction } from './threat-actions';

interface MaybeUser { name: string; email: string; role: string }

interface AnyThreat {
	id: string;
	severity: string;
	type: string;
	title: string;
	description: string;
	user: MaybeUser | null;
	affectedUsers?: number;
	details: Record<string, unknown>;
	riskScore: number;
	timestamp: string;
	firstSeen?: string;
	lastSeen?: string;
	occurrences?: number;
	occurrenceDates?: string[];
	status: string;
	suggestedActions: string[];
	actions?: ThreatAction[];
}

/** Map a Graph risk detection to the unified Threat shape. */
export function mapRiskDetection(r: any): AnyThreat {
	const user = r.userPrincipalName
		? { name: r.userDisplayName || r.userPrincipalName, email: r.userPrincipalName, role: 'User' }
		: null;
	const locationParts = [r.location?.city, r.location?.countryOrRegion].filter(Boolean);
	const location = locationParts.join(', ');
	const details: Record<string, unknown> = {};
	if (r.source) details.source = r.source;
	if (r.riskState) details.riskState = r.riskState;
	if (r.activity) details.activity = r.activity;
	if (r.ipAddress) details.ipAddress = r.ipAddress;
	if (location) details.location = location;
	return {
		id: r.id,
		severity: r.riskLevel === 'high' ? 'high' : r.riskLevel === 'medium' ? 'medium' : 'low',
		type: r.riskEventType || 'risk_detection',
		title: `Risk detection: ${r.riskEventType || 'Unknown'}`,
		description: `${r.activity || 'Sign-in'} risk${r.ipAddress ? ` from ${r.ipAddress}` : ''}${location ? ` (${location})` : ''}`,
		user,
		details,
		riskScore: r.riskLevel === 'high' ? 80 : r.riskLevel === 'medium' ? 50 : 20,
		timestamp: r.detectedDateTime || r.activityDateTime || new Date().toISOString(),
		status: r.riskState === 'remediated' ? 'resolved' : 'open',
		suggestedActions: [],
	};
}

/** Map a tenant-level DB alert row to the unified Threat shape. */
export function mapDbAlert(a: any): AnyThreat {
	const type = a.type || 'alert';
	const actions = suggestActions(type, a.severity, false);
	let details: Record<string, unknown> = {};
	if (a.metadata) {
		try {
			const parsed = JSON.parse(a.metadata);
			if (parsed && typeof parsed === 'object') details = parsed;
		} catch { /* ignore malformed metadata */ }
	}
	return {
		id: a.id,
		severity: a.severity || 'medium',
		type,
		title: a.title || 'Security Alert',
		description: a.description || '',
		user: null,
		affectedUsers: Number(a.affected_users ?? 0) || undefined,
		details,
		riskScore: a.severity === 'critical' ? 90 : a.severity === 'high' ? 70 : a.severity === 'medium' ? 50 : 25,
		timestamp: a.created_at || new Date().toISOString(),
		status: a.status || 'open',
		suggestedActions: actions.map(x => x.label),
		actions,
	};
}

/**
 * Group threats by lowercased title; keep newest occurrence as the canonical
 * record and aggregate first/last seen + distinct day buckets.
 */
export function groupByTitle(raw: AnyThreat[]): AnyThreat[] {
	const grouped = new Map<string, AnyThreat>();
	for (const t of raw) {
		const key = (t.title || '').toLowerCase().trim();
		const ts = t.timestamp;
		const existing = grouped.get(key);
		if (existing) {
			existing.occurrences = (existing.occurrences || 1) + 1;
			existing.occurrenceDates = [...(existing.occurrenceDates || []), ts];
			if (new Date(ts) > new Date(existing.lastSeen || ts)) {
				existing.lastSeen = ts;
				existing.timestamp = ts;
				if (t.description) existing.description = t.description;
			}
			if (new Date(ts) < new Date(existing.firstSeen || ts)) existing.firstSeen = ts;
			if ((t.riskScore ?? 0) > (existing.riskScore ?? 0)) existing.riskScore = t.riskScore;
			if (!existing.user && t.user) existing.user = t.user;
		} else {
			grouped.set(key, { ...t, occurrences: 1, firstSeen: ts, lastSeen: ts, occurrenceDates: [ts] });
		}
	}

	// Collapse to ≤5 distinct day-buckets (most recent first) and ensure actions
	for (const t of grouped.values()) {
		if (!t.actions || t.actions.length === 0) {
			t.actions = suggestActions(t.type || '', t.severity, !!(t.user && t.user.email));
			t.suggestedActions = t.actions.map(a => a.label);
		}
		const distinctDays = new Set<string>();
		const buckets: string[] = [];
		for (const d of (t.occurrenceDates || []).slice().sort((a, b) => new Date(b).getTime() - new Date(a).getTime())) {
			const day = new Date(d).toISOString().slice(0, 10);
			if (!distinctDays.has(day)) { distinctDays.add(day); buckets.push(d); }
			if (buckets.length >= 5) break;
		}
		t.occurrenceDates = buckets;
	}

	return [...grouped.values()];
}
