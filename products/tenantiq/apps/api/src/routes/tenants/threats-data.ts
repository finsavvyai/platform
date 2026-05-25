export interface ThreatAction {
	label: string;
	href?: string;
	kind?: 'primary' | 'danger' | 'secondary';
}

export interface Threat {
	id: string;
	severity: string;
	type: string;
	title: string;
	description: string;
	user: { name: string; email: string; role: string } | null;
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

// Returns empty until real Graph Security API detection is connected
export function getThreatData(_tenantId: string): Threat[] {
	return [];
}

export function getThreatSummary(threats: Threat[]) {
	return {
		total: threats.length,
		critical: threats.filter(t => t.severity === 'critical').length,
		high: threats.filter(t => t.severity === 'high').length,
		medium: threats.filter(t => t.severity === 'medium').length,
		low: threats.filter(t => t.severity === 'low').length,
		openThreats: threats.filter(t => t.status === 'open').length,
	};
}

/**
 * Severity rank for sorting. Higher number = higher priority.
 */
export const SEVERITY_RANK: Record<string, number> = {
	critical: 4,
	high: 3,
	medium: 2,
	low: 1,
	informational: 0,
	unknown: 0,
};

export function sortThreatsBySeverity<T extends { severity: string; lastSeen?: string; timestamp: string; riskScore?: number }>(threats: T[]): T[] {
	return [...threats].sort((a, b) => {
		const sa = SEVERITY_RANK[a.severity] ?? 0;
		const sb = SEVERITY_RANK[b.severity] ?? 0;
		if (sa !== sb) return sb - sa;
		const ra = a.riskScore ?? 0;
		const rb = b.riskScore ?? 0;
		if (ra !== rb) return rb - ra;
		const ta = new Date(a.lastSeen ?? a.timestamp).getTime();
		const tb = new Date(b.lastSeen ?? b.timestamp).getTime();
		return tb - ta;
	});
}
