/**
 * OpenClaw Bridge Types
 *
 * Shared interfaces for the OpenClaw/Luna AI agent bridge.
 */

export interface AgentResult {
	output: string;
	executionId: string;
	durationMs: number;
	agent: string;
	provider: string;
}

export interface SearchResult {
	results: Array<{
		id: string;
		score: number;
		content: string;
		metadata: Record<string, unknown>;
	}>;
	total: number;
	searchTimeMs: number;
}

export interface TenantSecurityAnalysis {
	riskScore: number; // 0-100
	criticalFindings: string[];
	recommendations: string[];
	complianceGaps: string[];
	estimatedRemediationHours: number;
	rawAnalysis: string;
}

export interface LicenseOptimizationResult {
	wastedLicenses: number;
	estimatedMonthlySavings: number;
	recommendations: Array<{
		action: string;
		users: string[];
		saving: number;
		priority: 'high' | 'medium' | 'low';
	}>;
	rawAnalysis: string;
}

export interface TenantSecurityContext {
	tenantId: string;
	displayName: string;
	userCount: number;
	mfaDisabledCount: number;
	inactiveUserCount: number;
	adminCount: number;
	guestCount: number;
	riskyUsers: string[];
	alerts: Array<{ type: string; severity: string; title: string }>;
}

export interface LicenseContext {
	tenantId: string;
	displayName: string;
	licenses: Array<{
		skuName: string;
		assigned: number;
		active: number;
		cost: number;
	}>;
	inactiveUsers: Array<{
		name: string;
		daysSinceLogin: number;
		licenses: string[];
	}>;
}

export interface BridgeCallResult {
	data: any;
	requestId: string;
	durationMs: number;
}
