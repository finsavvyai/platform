import type { GraphSecurityAlert } from '../../lib/graph-client';
import type { Threat } from './threats-data';

const SEVERITY_MAP: Record<string, string> = {
	high: 'high', medium: 'medium', low: 'low',
	informational: 'low', unknown: 'low',
};

const RISK_SCORES: Record<string, number> = {
	high: 85, medium: 60, low: 30, informational: 15, unknown: 10,
};

function extractUser(alert: GraphSecurityAlert) {
	const ev = alert.evidence?.find(e => e.userAccount);
	if (!ev?.userAccount) return null;
	const name = ev.userAccount.displayName || ev.userAccount.accountName;
	const email = ev.userAccount.userPrincipalName;
	if (!name && !email) return null;
	return {
		name: name || email || 'Unknown user',
		email: email || '',
		role: 'User',
	};
}

export function mapGraphAlerts(alerts: GraphSecurityAlert[]): Threat[] {
	return alerts.map((a) => ({
		id: a.id,
		severity: (SEVERITY_MAP[a.severity] || 'low') as Threat['severity'],
		type: a.category || 'Unknown',
		title: a.title,
		description: a.description || '',
		user: extractUser(a),
		details: {},
		riskScore: RISK_SCORES[a.severity] ?? 10,
		timestamp: a.createdDateTime,
		status: a.status === 'resolved' ? 'resolved' : 'open',
		suggestedActions: [],
	}));
}
