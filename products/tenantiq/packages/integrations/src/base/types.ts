/** Supported PSA/RMM providers */
export type PSAProvider = 'connectwise' | 'datto' | 'kaseya';

/** Integration connection status */
export type IntegrationStatus = 'pending' | 'active' | 'error' | 'disconnected';

/** Entity types that can be mapped between systems */
export type MappingEntityType = 'tenant' | 'alert' | 'user' | 'agreement';

/** Severity mapping from TenantIQ → PSA ticket priority */
export const SEVERITY_MAP = {
	critical: { connectwise: 1, datto: 1, kaseya: 1, label: 'Critical' },
	high: { connectwise: 2, datto: 2, kaseya: 2, label: 'High' },
	medium: { connectwise: 3, datto: 3, kaseya: 3, label: 'Medium' },
	low: { connectwise: 4, datto: 4, kaseya: 4, label: 'Low' },
} as const;

/** Credentials stored encrypted per provider */
export interface ConnectWiseCredentials {
	companyId: string;
	publicKey: string;
	privateKey: string;
	siteUrl: string; // e.g. https://api-na.myconnectwise.net
	clientId: string;
}

export interface DattoCredentials {
	apiUser: string;
	apiSecret: string;
	trackingId: string;
	zoneUrl: string; // e.g. https://webservices2.autotask.net
}

export interface KaseyaCredentials {
	apiUrl: string;
	apiKey: string;
	tenantId: string;
}

export type ProviderCredentials =
	| ConnectWiseCredentials
	| DattoCredentials
	| KaseyaCredentials;

/** Generic company/account from PSA */
export interface PSACompany {
	id: string;
	name: string;
	identifier?: string;
	status?: string;
}

/** Generic ticket in PSA */
export interface PSATicket {
	id: string;
	summary: string;
	description: string;
	priority: number;
	status: string;
	companyId: string;
	createdAt: string;
	updatedAt?: string;
}

/** Generic agreement/contract in PSA */
export interface PSAAgreement {
	id: string;
	name: string;
	companyId: string;
	type: string;
	amount?: number;
	startDate: string;
	endDate?: string;
}

/** Result of a sync operation */
export interface SyncResult {
	provider: PSAProvider;
	entityType: MappingEntityType;
	created: number;
	updated: number;
	failed: number;
	errors: string[];
	durationMs: number;
}
