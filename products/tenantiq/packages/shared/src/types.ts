// ============================================================
// Core domain types for TenantIQ
// ============================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type AlertCategory = 'security' | 'optimization' | 'compliance' | 'operational';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';
export type RemediationType = 'automatic' | 'semi_automatic' | 'manual';
export type TenantStatus = 'active' | 'suspended' | 'disconnected';
export type UserRole = 'viewer' | 'operator' | 'admin' | 'super_admin';
export type OrganizationType = 'direct' | 'msp';
export type RemediationStatus = 'pending' | 'executing' | 'success' | 'failed' | 'rolled_back';
export type WorkflowTriggerType = 'cron' | 'webhook' | 'manual' | 'conditional';
export type WorkflowRunStatus = 'pending_approval' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Organization {
	id: string;
	name: string;
	type: OrganizationType;
	billingPlan: string;
	createdAt: string;
}

export interface Tenant {
	id: string;
	organizationId: string;
	azureTenantId: string;
	displayName: string;
	domain: string;
	lastSyncAt: string | null;
	status: TenantStatus;
	createdAt: string;
}

export interface CachedUser {
	id: string;
	tenantId: string;
	azureUserId: string;
	displayName: string;
	email: string;
	userType: 'member' | 'guest';
	accountEnabled: boolean;
	lastSignIn: string | null;
	lastNonInteractiveSignIn: string | null;
	assignedLicenses: string[];
	assignedGroups: string[];
	createdAt: string;
	updatedAt: string;
}

export interface LicenseCache {
	id: string;
	tenantId: string;
	skuId: string;
	skuName: string;
	total: number;
	assigned: number;
	costPerUnit: number | null;
	updatedAt: string;
}

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

export interface RemediationLog {
	id: string;
	tenantId: string;
	alertId: string;
	actionId: string;
	executedBy: string;
	status: RemediationStatus;
	beforeState: unknown;
	afterState: unknown;
	errorMessage: string | null;
	executedAt: string;
	rollbackAvailable: boolean;
	rollbackExpiresAt: string | null;
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

export interface WorkflowStep {
	action: string;
	condition?: string;
	onFailure: 'skip' | 'abort' | 'retry';
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

export interface PlatformUser {
	id: string;
	organizationId: string;
	email: string;
	name: string;
	role: UserRole;
	azureOid: string | null;
	lastLoginAt: string | null;
	createdAt: string;
}

// Intelligence Engine types
export interface Rule {
	id: string;
	name: string;
	severity: Severity;
	category: AlertCategory;
	remediationType: RemediationType;
	evaluate(tenant: Tenant, data: TenantData): Promise<AlertCandidate[]>;
}

export interface TenantData {
	users: CachedUser[];
	licenses: LicenseCache[];
	signInLogs?: unknown[];
	conditionalAccessPolicies?: unknown[];
	riskyUsers?: unknown[];
	groups?: unknown[];
}

export interface AlertCandidate {
	ruleId: string;
	title: string;
	description: string;
	businessImpact: string | null;
	affectedResources: unknown[];
	recommendedAction: string | null;
}

// Dashboard types
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
