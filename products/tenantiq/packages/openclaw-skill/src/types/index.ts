/**
 * OpenClaw Skill Type Definitions for TenantIQ
 */

export interface OpenClawContext {
	/** User's OpenClaw user ID */
	userId: string;
	/** Current conversation/session ID */
	sessionId: string;
	/** Platform the user is messaging from (whatsapp, slack, teams, etc.) */
	platform: 'whatsapp' | 'slack' | 'teams' | 'discord' | 'telegram' | 'imessage' | 'other';
	/** User's preferred language */
	language?: string;
	/** Stored user configuration */
	config: Record<string, unknown>;
}

export interface TenantIQConfig {
	/** TenantIQ API base URL */
	apiUrl: string;
	/** OAuth2 access token */
	accessToken?: string;
	/** OAuth2 refresh token */
	refreshToken?: string;
	/** Token expiry timestamp */
	tokenExpiresAt?: number;
	/** Currently selected tenant ID */
	activeTenantId?: string;
	/** User's TenantIQ user ID */
	tenantiqUserId?: string;
}

export interface CommandContext {
	/** OpenClaw context */
	openclaw: OpenClawContext;
	/** TenantIQ configuration */
	config: TenantIQConfig;
	/** Command arguments */
	args: string[];
	/** Raw command string */
	raw: string;
}

export interface CommandResponse {
	/** Response message to display */
	message: string;
	/** Optional rich formatting (markdown) */
	format?: 'text' | 'markdown' | 'html';
	/** Optional attachment URLs */
	attachments?: string[];
	/** Suggested follow-up actions */
	suggestedActions?: Array<{
		label: string;
		command: string;
	}>;
	/** Error flag */
	error?: boolean;
}

export interface Command {
	/** Command name (e.g., "security status") */
	name: string;
	/** Command description */
	description: string;
	/** Command category */
	category: 'security' | 'licenses' | 'users' | 'compliance' | 'tenants' | 'ai' | 'general';
	/** Aliases for this command */
	aliases?: string[];
	/** Example usage */
	examples?: string[];
	/** Handler function */
	handler: (ctx: CommandContext) => Promise<CommandResponse>;
	/** Requires authentication */
	requiresAuth?: boolean;
}

export interface TenantIQApiClient {
	/** Get security status */
	getSecurityStatus(tenantId: string): Promise<SecurityStatus>;
	/** List alerts */
	listAlerts(tenantId: string, filters?: AlertFilters): Promise<Alert[]>;
	/** Get license waste analysis */
	getLicenseWaste(tenantId: string): Promise<LicenseWaste>;
	/** Search users */
	searchUsers(tenantId: string, query: string): Promise<User[]>;
	/** Get tenant dashboard */
	getDashboard(tenantId: string): Promise<Dashboard>;
	/** List tenants */
	listTenants(): Promise<Tenant[]>;
	/** Execute remediation */
	executeRemediation(tenantId: string, actionId: string, params: Record<string, unknown>): Promise<RemediationResult>;
	/** Ask AI */
	askAI(tenantId: string, question: string): Promise<string>;
}

export interface SecurityStatus {
	secureScore: number;
	alertCounts: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	mfaAdoption: number;
	riskyUsers: number;
}

export interface Alert {
	id: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	description: string;
	category: 'security' | 'optimization' | 'compliance' | 'operational';
	affectedEntities: string[];
	suggestedRemediations?: string[];
	createdAt: string;
}

export interface AlertFilters {
	severity?: 'critical' | 'high' | 'medium' | 'low';
	category?: 'security' | 'optimization' | 'compliance' | 'operational';
	status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
}

export interface LicenseWaste {
	totalWasteMonthly: number;
	totalWasteYearly: number;
	breakdown: {
		inactiveUsers: { count: number; cost: number };
		unassigned: { count: number; cost: number };
		underutilized: { count: number; cost: number };
	};
	recommendations: Array<{
		action: string;
		impact: number;
	}>;
}

export interface User {
	id: string;
	displayName: string;
	email: string;
	lastSignIn?: string;
	mfaEnabled: boolean;
	licenses: string[];
	isGuest: boolean;
}

export interface Tenant {
	id: string;
	name: string;
	domain: string;
	status: 'active' | 'syncing' | 'error';
	lastSyncAt?: string;
}

export interface Dashboard {
	userCount: number;
	guestCount: number;
	alertCounts: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	licenseWaste: number;
	secureScore: number;
}

export interface RemediationResult {
	success: boolean;
	message: string;
	affectedEntities: string[];
}

export interface WebhookEvent {
	event: 'alert.created' | 'alert.updated' | 'tenant.synced' | 'remediation.completed';
	tenant: {
		id: string;
		name: string;
	};
	data: Record<string, unknown>;
	timestamp: string;
}
