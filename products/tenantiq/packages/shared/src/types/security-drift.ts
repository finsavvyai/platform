export interface SecurityStackSnapshot {
	conditionalAccess: {
		policyCount: number;
		mfaEnabled: boolean;
		legacyBlocked: boolean;
	};
	dlp: {
		policyCount: number;
		labelsCount: number;
	};
	identity: {
		mfaCoverage: number;
		riskyUsers: number;
		signInRiskPolicy: boolean;
	};
	email: {
		safeLinks: boolean;
		safeAttachments: boolean;
		antiPhishing: boolean;
	};
	timestamp: string;
}

export interface SecurityDrift {
	id: string;
	product: string;
	field: string;
	previousValue: unknown;
	currentValue: unknown;
	severity: 'critical' | 'high' | 'medium' | 'low';
	recommendation: string;
	acknowledged?: boolean;
	detectedAt?: string;
}

export interface SecurityStackMonitorResponse {
	lastScan: string | null;
	drifts: SecurityDrift[];
	snapshot: SecurityStackSnapshot | null;
}
