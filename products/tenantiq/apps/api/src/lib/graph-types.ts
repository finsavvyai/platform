/**
 * Microsoft Graph API type definitions — shared across graph-client modules.
 */

export interface GraphUser {
	id: string;
	userPrincipalName: string;
	displayName: string;
	mail?: string;
	jobTitle?: string;
	department?: string;
	accountEnabled: boolean;
	createdDateTime: string;
	signInActivity?: {
		lastSignInDateTime?: string;
		lastNonInteractiveSignInDateTime?: string;
	};
	assignedLicenses: Array<{ skuId: string; disabledPlans: string[] }>;
}

export interface GraphSubscribedSku {
	id: string;
	skuId: string;
	skuPartNumber: string;
	capabilityStatus: string;
	consumedUnits: number;
	prepaidUnits: { enabled: number; suspended: number; warning: number };
}

export interface GraphSecurityAlert {
	id: string;
	title: string;
	description: string;
	severity: 'unknown' | 'informational' | 'low' | 'medium' | 'high';
	status: 'new' | 'inProgress' | 'resolved' | 'unknownFutureValue';
	category: string;
	createdDateTime: string;
	lastUpdateDateTime: string;
	evidence?: Array<{
		'@odata.type'?: string;
		userAccount?: { accountName?: string; displayName?: string; userPrincipalName?: string };
		ipAddress?: string;
	}>;
}

export interface GraphResponse<T> {
	value: T[];
	'@odata.nextLink'?: string;
}

export type MsGraphCloud = 'Public' | 'USGov' | 'China';

export interface ClientEnv {
	KV: KVNamespace;
	AZURE_CLIENT_ID?: string;
	AZURE_CLIENT_SECRET?: string;
	GRAPH_TOKEN_KEK?: string;
	// Sovereign-cloud selector. Default 'Public'. Set 'USGov' for graph.microsoft.us
	// or 'China' for microsoftgraph.chinacloudapi.cn. Tracked by the Monkey365 lift
	// in .luna/tenantiq/leverage/monkey365/integration-plan.md.
	MS_GRAPH_CLOUD?: MsGraphCloud;
}
