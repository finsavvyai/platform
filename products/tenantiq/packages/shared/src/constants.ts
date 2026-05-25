// ============================================================
// Application constants
// ============================================================

export const SEVERITY_ORDER = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3
} as const;

export const SEVERITY_COLORS = {
	critical: '#d13438',
	high: '#ff8c00',
	medium: '#ffb900',
	low: '#0078d4'
} as const;

export const CATEGORY_LABELS = {
	security: 'Security',
	optimization: 'Optimization',
	compliance: 'Compliance',
	operational: 'Operational'
} as const;

export const RULE_IDS = {
	// Security
	SEC_001: 'SEC-001', // MFA not enforced for admins
	SEC_002: 'SEC-002', // Legacy authentication enabled
	SEC_003: 'SEC-003', // Impossible travel detection
	SEC_004: 'SEC-004', // Failed login spike
	SEC_005: 'SEC-005', // Risky sign-ins unaddressed
	SEC_006: 'SEC-006', // External sharing overshare

	// Optimization
	OPT_001: 'OPT-001', // Inactive users (30/60/90 days)
	OPT_002: 'OPT-002', // Underutilized E5 licenses
	OPT_003: 'OPT-003', // Unassigned licenses

	// Compliance
	CMP_001: 'CMP-001', // Stale guest users
	CMP_002: 'CMP-002', // Groups without owners
	CMP_003: 'CMP-003', // Conditional access policy disabled

	// Operational
	OPS_001: 'OPS-001', // Service health degradation
	OPS_002: 'OPS-002', // Sync errors detected

	// Backup Health
	BKP_001: 'BKP-001', // Backup stale (no backup in 48+ hours)
	BKP_002: 'BKP-002', // Backup size anomaly (>50% drop)
	BKP_003: 'BKP-003', // Backup encryption key not rotated
	BKP_004: 'BKP-004', // Backup failure

	// CI/CD Security
	CICD_005: 'CICD-005', // Federated identity credentials not repo-scoped

	// After-Hours Escalation
	AH_001: 'AH-001', // After-hours config change
	AH_002: 'AH-002', // Weekend config change
	AH_003: 'AH-003', // No business-hours login for 48+ hours

	// Copilot Security
	CPG_001: 'CPG-001', // Copilot prompt injection detected
	CPG_002: 'CPG-002', // Copilot sensitivity escalation
	CPG_003: 'CPG-003', // Copilot bulk data access
} as const;

export const REMEDIATION_ACTION_IDS = {
	REM_001: 'REM-001', // Decommission User
	REM_002: 'REM-002', // Enable MFA Policy
	REM_003: 'REM-003', // Block IP Range
	REM_004: 'REM-004', // Downgrade License
	REM_005: 'REM-005', // Revoke Sessions
	REM_006: 'REM-006', // Force Password Reset
	REM_007: 'REM-007', // Remove Guest User
	REM_008: 'REM-008', // Restrict External Sharing
	REM_009: 'REM-009'  // Enable Conditional Access
} as const;

// Microsoft 365 License SKU costs (monthly, approximate)
export const LICENSE_COSTS: Record<string, number> = {
	'Microsoft 365 E5': 57.0,
	'Microsoft 365 E3': 36.0,
	'Microsoft 365 E1': 10.0,
	'Microsoft 365 Business Premium': 22.0,
	'Microsoft 365 Business Standard': 12.5,
	'Microsoft 365 Business Basic': 6.0,
	'Exchange Online (Plan 2)': 8.0,
	'Exchange Online (Plan 1)': 4.0
};

// Scan schedules (cron expressions)
export const SCAN_SCHEDULES = {
	USER_SYNC: '0 */6 * * *',       // Every 6 hours
	SECURITY_SCAN: '0 * * * *',     // Every hour
	COMPLIANCE_SCAN: '0 3 * * *',   // Daily at 3am
	WORKFLOW_CHECK: '*/15 * * * *'  // Every 15 minutes
} as const;

// Rate limits
export const RATE_LIMITS = {
	AI_CHAT_PER_HOUR: 50,
	REMEDIATION_PER_MINUTE: 10,
	API_PER_MINUTE: 120,
	BATCH_OPERATION_MAX: 50
} as const;
