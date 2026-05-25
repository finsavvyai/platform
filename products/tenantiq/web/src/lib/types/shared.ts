export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type AlertCategory = 'security' | 'optimization' | 'compliance' | 'operational';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';
export type RemediationType = 'automatic' | 'semi_automatic' | 'manual';
export type WorkflowTriggerType = 'cron' | 'webhook' | 'manual' | 'conditional';
export type WorkflowRunStatus = 'pending_approval' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Alert {
	id: string;
	tenantId: string;
	ruleId: string;
	severity: Severity;
	category: AlertCategory;
	title: string;
	description: string;
	businessImpact: string | null;
	affectedResources: unknown[];
	recommendedAction: string | null;
	remediationType: RemediationType;
	status: AlertStatus;
	createdAt: string;
	resolvedAt: string | null;
	resolvedBy: string | null;
	metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
	id: string;
	tenantId: string;
	actor: string;
	action: string;
	resourceType: string | null;
	resourceId: string | null;
	details: unknown;
	ipAddress: string | null;
	createdAt: string;
}

export interface WorkflowStep {
	action: string;
	condition?: string;
	onFailure: 'skip' | 'abort' | 'retry';
}

export interface Workflow {
	id: string;
	tenantId: string;
	name: string;
	workflowType: string;
	triggerType: WorkflowTriggerType;
	triggerConfig: unknown;
	steps: WorkflowStep[];
	requiresApproval: boolean;
	enabled: boolean;
	lastRunAt: string | null;
	lastRunStatus: string | null;
	createdAt: string;
}

export interface WorkflowRun {
	id: string;
	workflowId: string;
	tenantId: string;
	status: WorkflowRunStatus;
	stepsCompleted: number;
	stepsTotal: number;
	results: unknown;
	startedAt: string;
	completedAt: string | null;
	approvedBy: string | null;
}

export interface UserBreakdown {
	total: number;
	active: number;
	inactive: number;
	guests: number;
	disabled: number;
}

export interface RiskyUser {
	displayName: string;
	email: string;
	riskReason: string;
	daysSinceSignIn: number | null;
	accountEnabled: boolean;
}

export interface LicenseSkuBreakdown {
	skuName: string;
	assigned: number;
	total: number;
	costPerUnit: number;
}

export interface DashboardMetrics {
	secureScore: number | null;
	secureScoreTrend: number[];
	activeAlerts: { critical: number; high: number; medium: number; low: number };
	totalUsers: number;
	activeUsers: number;
	licenseWaste: number;
	totalLicenseSpend: number;
	userBreakdown: UserBreakdown;
	topRiskyUsers: RiskyUser[];
	licenseUtilization: number;
	licenseBreakdown: LicenseSkuBreakdown[];
	recentAlerts: Alert[];
	lastSyncAt: string | null;
}
