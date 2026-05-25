/**
 * Shared type definitions for advanced security rules
 */

export interface SignInLog {
	userPrincipalName: string;
	createdDateTime: string;
	ipAddress?: string;
	location?: { city?: string; countryOrRegion?: string };
	userType?: string;
	isInteractive?: boolean;
}

export interface AdminUser {
	userPrincipalName: string;
	assignedRoles?: string[];
}

export interface ServicePrincipal {
	displayName: string;
	appId: string;
	publisherName?: string;
	oauth2PermissionScopes?: Array<{ value: string }>;
}

export interface PasswordPolicy {
	minimumLength?: number;
	requireUppercase?: boolean;
	requireLowercase?: boolean;
	requireNumbers?: boolean;
	requireSymbols?: boolean;
	passwordExpirationDays?: number;
}

export interface FileActivity {
	userEmail: string;
	action: string;
	fileCount: number;
	timestamp: string;
	destination?: string;
}
