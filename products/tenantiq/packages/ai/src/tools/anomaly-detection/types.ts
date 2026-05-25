/**
 * Anomaly Detection — Type Definitions
 */

export interface AnomalyEvent {
	id: string;
	type: AnomalyType;
	severity: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	description: string;
	detectedAt: string;
	affectedResources: string[];
	confidence: number; // 0-100
	baseline: string;
	observed: string;
	deviation: number; // standard deviations from baseline
	recommendation: string;
	autoRemediable: boolean;
	category: 'security' | 'cost' | 'compliance' | 'operational';
}

export type AnomalyType =
	| 'impossible_travel'
	| 'off_hours_login'
	| 'brute_force'
	| 'permission_escalation'
	| 'mass_deletion'
	| 'license_spike'
	| 'license_drop'
	| 'cost_spike'
	| 'shadow_it'
	| 'data_exfiltration'
	| 'inactive_admin_login'
	| 'guest_surge'
	| 'mfa_bypass'
	| 'unusual_app_consent';

export interface AnomalyBaseline {
	metric: string;
	mean: number;
	stdDev: number;
	min: number;
	max: number;
	samples: number;
}

export interface LoginEvent {
	userId: string;
	userEmail: string;
	timestamp: string;
	ipAddress: string;
	location?: { city: string; country: string; lat: number; lon: number };
	success: boolean;
	appUsed?: string;
	devicePlatform?: string;
	riskLevel?: 'none' | 'low' | 'medium' | 'high';
}

export interface ActivityMetrics {
	activeUsersToday: number;
	activeUsersBaseline: number;
	loginsToday: number;
	loginsBaseline: number;
	failedLoginsToday: number;
	failedLoginsBaseline: number;
	newAppsConsented: number;
	newAppsBaseline: number;
	licensesAssignedToday: number;
	licensesRemovedToday: number;
	licensesChangeBaseline: number;
	filesSharedExternally: number;
	filesSharedBaseline: number;
	adminActionsToday: number;
	adminActionsBaseline: number;
	guestUsersAdded: number;
	guestUsersBaseline: number;
	costToday: number;
	costBaseline: number;
}

export interface AnomalyReport {
	tenantId: string;
	tenantName: string;
	generatedAt: string;
	anomalies: AnomalyEvent[];
	riskScore: number; // 0-100
	riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
	summary: string;
	trendAnalysis: TrendPoint[];
	smartDigest: string; // natural-language summary for notifications
}

export interface TrendPoint {
	date: string;
	anomalyCount: number;
	riskScore: number;
}
