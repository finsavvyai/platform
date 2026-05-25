/**
 * Centralized constants — no magic numbers in route handlers.
 */

// ─── Time (seconds) ─────────────────────────────────────────────────────────

export const TTL = {
	/** 5 minutes — OAuth state parameter */
	AUTH_STATE: 300,
	/** 1 minute — sync in-progress marker */
	SYNC_PROGRESS: 60,
	/** 10 minutes — sync start marker */
	SYNC_START: 600,
	/** 1 hour — Graph access token, CIS scan, storage, copilot usage */
	ONE_HOUR: 3600,
	/** 2 hours — Copilot readiness, Graph token cache */
	TWO_HOURS: 7200,
	/** 1 day — session, drift detection, CIS daily scan, notifications */
	ONE_DAY: 86400,
	/** 7 days — security scan secure score */
	ONE_WEEK: 604800,
	/** 30 days — SDLC config */
	ONE_MONTH: 86400 * 30,
	/** 90 days — config snapshot retention */
	THREE_MONTHS: 86400 * 90,
	/** 1 year — synced marker, HSTS, backup metadata */
	ONE_YEAR: 86400 * 365,
} as const;

// ─── Time (milliseconds) ────────────────────────────────────────────────────

export const TTL_MS = {
	/** 7 days — trial period, invite expiration */
	SEVEN_DAYS: 7 * 86400000,
} as const;

// ─── Thresholds ─────────────────────────────────────────────────────────────

export const THRESHOLDS = {
	/** Days without sign-in before user is considered inactive */
	INACTIVE_DAYS: 90,
	/** CIS: recommended min/max Global Admins */
	GLOBAL_ADMIN_MIN: 2,
	GLOBAL_ADMIN_MAX: 4,
	/** MFA registration percentage considered sufficient */
	MFA_ADEQUATE_PCT: 90,
	MFA_PARTIAL_PCT: 50,
	/** Sensitivity labels minimum for Copilot readiness */
	MIN_SENSITIVITY_LABELS: 3,
} as const;

// ─── AI Model ───────────────────────────────────────────────────────────────

export const AI = {
	MODEL: 'claude-opus-4-7',
	API_VERSION: '2023-06-01',
	MAX_TOKENS_DEFAULT: 16000,
	MAX_TOKENS_LARGE: 16000,
	TEMPERATURE_DEFAULT: 0.3,
} as const;

export const DEEPSEEK = {
	MODEL: 'deepseek-chat',
	BASE_URL: 'https://api.deepseek.com/v1/chat/completions',
	MAX_TOKENS_DEFAULT: 2048,
	TEMPERATURE_DEFAULT: 0.3,
} as const;

export const GROQ = {
	MODEL: 'llama-3.3-70b-versatile',
	BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',
	MAX_TOKENS_DEFAULT: 2048,
	TEMPERATURE_DEFAULT: 0.3,
} as const;

export const GEMINI = {
	MODEL: 'gemini-2.0-flash',
	BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
	MAX_TOKENS_DEFAULT: 2048,
	TEMPERATURE_DEFAULT: 0.3,
} as const;

// ─── Microsoft Graph ────────────────────────────────────────────────────────

export const GRAPH = {
	BASE_URL: 'https://graph.microsoft.com/v1.0',
	AUTH_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0',
	SCOPE: 'https://graph.microsoft.com/.default',
	OAUTH_SCOPES: [
		'openid', 'profile', 'email', 'offline_access',
		'User.Read', 'User.Read.All', 'User.ReadWrite.All',
		'Group.Read.All', 'Group.ReadWrite.All',
		'Directory.Read.All', 'Organization.Read.All',
		'SecurityEvents.Read.All', 'AuditLog.Read.All',
		'Policy.Read.All', 'Policy.ReadWrite.ConditionalAccess',
		'IdentityRiskEvent.Read.All', 'IdentityRiskyUser.Read.All',
		'UserAuthenticationMethod.Read.All', 'UserAuthenticationMethod.ReadWrite.All',
		'RoleManagement.Read.All', 'Reports.Read.All', 'Application.Read.All',
		'Sites.Read.All', 'MailboxSettings.Read', 'InformationProtectionPolicy.Read',
		// NOTE: `InformationProtectionPolicy.ReadWrite.All` is NOT a valid delegated
		// scope — Microsoft returns AADSTS650053. Only `.Read` (above) exists as
		// delegated; the `.ReadWrite.All` variant only exists as application permission.
		'CrossTenantInformation.ReadBasic.All',
		'DelegatedPermissionGrant.Read.All',
		'DeviceManagementConfiguration.Read.All',
	].join(' '),
} as const;

// OAuth providers (LinkedIn, personal Graph scopes) live in ./auth-providers.
export { LINKEDIN, GRAPH_PERSONAL_SCOPES } from './auth-providers';

// ─── URLs ───────────────────────────────────────────────────────────────────

export const URLS = {
	FRONTEND: 'https://app.tenantiq.app',
	API: 'https://api.tenantiq.app',
	ALLOWED_ORIGINS: [
		'https://tenantiq.app',
		'https://www.tenantiq.app',
		'https://app.tenantiq.app',
		'https://api.tenantiq.app',
		'https://tenantiq.cc',
		'https://www.tenantiq.cc',
		'https://app.tenantiq.cc',
	],
} as const;

// ─── License Pricing (USD/month) ───────────────────────────────────────────

export const SKU_COSTS: Record<string, number> = {
	// Free SKUs
	WINDOWS_STORE: 0, FLOW_FREE: 0, POWER_BI_STANDARD: 0, POWERAPPS_DEV: 0,
	TEAMS_EXPLORATORY: 0, STREAM: 0,
	// Paid SKUs
	SPB: 22, SPE_E3: 36, SPE_E5: 57,
	ENTERPRISEPACK: 36, ENTERPRISEPREMIUM: 57,
	EXCHANGESTANDARD: 4, EXCHANGEENTERPRISE: 8,
	O365_BUSINESS_ESSENTIALS: 6, O365_BUSINESS_PREMIUM: 22,
	SMB_BUSINESS_PREMIUM: 22, SMB_BUSINESS: 12,
	VISIOCLIENT: 15, PROJECTPROFESSIONAL: 55,
	ATP_ENTERPRISE: 2, THREAT_INTELLIGENCE: 5, EMSPREMIUM: 16,
	AAD_PREMIUM: 6, AAD_PREMIUM_P2: 9, INTUNE_A: 8,
};

export function getSkuCost(skuPartNumber: string | null): number {
	if (!skuPartNumber) return 12;
	const upper = skuPartNumber.toUpperCase();
	if (upper in SKU_COSTS) return SKU_COSTS[upper];
	return 12; // default for unknown paid SKUs
}

// ─── Friendly SKU Display Names ────────────────────────────────────────────

const SKU_DISPLAY_NAMES: Record<string, string> = {
	O365_BUSINESS_ESSENTIALS: 'Microsoft 365 Business Basic',
	O365_BUSINESS_PREMIUM: 'Microsoft 365 Business Premium',
	SMB_BUSINESS_PREMIUM: 'Microsoft 365 Business Premium',
	SMB_BUSINESS: 'Microsoft 365 Business Basic',
	SPB: 'Microsoft 365 Business Premium',
	SPE_E3: 'Microsoft 365 E3',
	SPE_E5: 'Microsoft 365 E5',
	ENTERPRISEPACK: 'Office 365 E3',
	ENTERPRISEPREMIUM: 'Office 365 E5',
	EXCHANGESTANDARD: 'Exchange Online (Plan 1)',
	EXCHANGEENTERPRISE: 'Exchange Online (Plan 2)',
	VISIOCLIENT: 'Visio Online Plan 2',
	PROJECTPROFESSIONAL: 'Project Plan 3',
	ATP_ENTERPRISE: 'Defender for Office 365 (Plan 1)',
	THREAT_INTELLIGENCE: 'Defender for Office 365 (Plan 2)',
	EMSPREMIUM: 'Enterprise Mobility + Security E5',
	AAD_PREMIUM: 'Entra ID P1',
	AAD_PREMIUM_P2: 'Entra ID P2',
	INTUNE_A: 'Microsoft Intune Plan 1',
	WINDOWS_STORE: 'Windows Store for Business',
	FLOW_FREE: 'Power Automate Free',
	POWER_BI_STANDARD: 'Power BI (Free)',
	POWERAPPS_DEV: 'Power Apps Developer',
	TEAMS_EXPLORATORY: 'Microsoft Teams Exploratory',
	STREAM: 'Microsoft Stream',
};

/** Convert a raw SKU part number to a user-friendly display name. */
export function getSkuDisplayName(skuPartNumber: string | null): string {
	if (!skuPartNumber) return 'Unknown License';
	const upper = skuPartNumber.toUpperCase();
	return SKU_DISPLAY_NAMES[upper] ?? formatRawSku(skuPartNumber);
}

/** Best-effort formatting for unmapped SKU IDs. */
function formatRawSku(raw: string): string {
	return raw
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/\bO365\b/i, 'Office 365')
		.replace(/\bSpe\b/i, 'Microsoft 365');
}
