/**
 * Microsoft Graph API Client — core auth, token management, and data methods.
 * Types in graph-types.ts. Extended methods in graph-client-extended.ts.
 */
import type { GraphUser, GraphSubscribedSku, GraphSecurityAlert, GraphResponse, ClientEnv, MsGraphCloud } from './graph-types';
import { getRefreshToken, putRefreshToken } from './graph-token-store';

export type { GraphUser, GraphSubscribedSku, GraphSecurityAlert, GraphResponse, ClientEnv, MsGraphCloud };

const CLOUD_ENDPOINTS: Record<MsGraphCloud, { login: string; graph: string }> = {
	Public: { login: 'https://login.microsoftonline.com', graph: 'https://graph.microsoft.com' },
	USGov: { login: 'https://login.microsoftonline.us', graph: 'https://graph.microsoft.us' },
	China: { login: 'https://login.partner.microsoftonline.cn', graph: 'https://microsoftgraph.chinacloudapi.cn' },
};

export function resolveCloud(env: ClientEnv): { login: string; graph: string } {
	return CLOUD_ENDPOINTS[env.MS_GRAPH_CLOUD ?? 'Public'];
}

async function refreshToken(env: ClientEnv, azureTenantId: string): Promise<string> {
	const rt = await getRefreshToken(env, azureTenantId);
	if (!rt) throw new Error('No Graph API token. Please sign out and sign in again.');
	const cloud = resolveCloud(env);
	const res = await fetch(`${cloud.login}/common/oauth2/v2.0/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.AZURE_CLIENT_ID || '',
			client_secret: env.AZURE_CLIENT_SECRET || '',
			refresh_token: rt,
			grant_type: 'refresh_token',
			scope: `${cloud.graph}/.default`,
		}),
	});
	if (!res.ok) throw new Error('Token refresh failed. Please sign out and sign in again.');
	const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
	await env.KV.put(`graph:${azureTenantId}:access_token`, data.access_token, { expirationTtl: data.expires_in || 3600 });
	if (data.refresh_token) await putRefreshToken(env, azureTenantId, data.refresh_token);
	return data.access_token;
}

// Client-credentials flow for daemon/server access (MSP-registered apps per tenant)
async function clientCredentialsToken(env: ClientEnv, azureTenantId: string): Promise<string> {
	const perTenantSecret = await env.KV.get(`graph:${azureTenantId}:client_secret`);
	const perTenantClientId = await env.KV.get(`graph:${azureTenantId}:client_id`);
	const clientId = perTenantClientId || env.AZURE_CLIENT_ID || '';
	const clientSecret = perTenantSecret || env.AZURE_CLIENT_SECRET || '';
	if (!clientId || !clientSecret) throw new Error('No client credentials for tenant. Store graph:{tenantId}:client_id and graph:{tenantId}:client_secret in KV.');
	const cloud = resolveCloud(env);
	const res = await fetch(`${cloud.login}/${azureTenantId}/oauth2/v2.0/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'client_credentials',
			scope: `${cloud.graph}/.default`,
		}),
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Client credentials token failed: ${err}`);
	}
	const data = (await res.json()) as { access_token: string; expires_in: number };
	await env.KV.put(`graph:${azureTenantId}:access_token`, data.access_token, { expirationTtl: data.expires_in || 3600 });
	return data.access_token;
}

async function getToken(env: ClientEnv, azureTenantId: string): Promise<string> {
	const cached = await env.KV.get(`graph:${azureTenantId}:access_token`);
	if (cached) return cached;
	// Try delegated (refresh_token) first, fall back to client_credentials
	const rt = await getRefreshToken(env, azureTenantId);
	if (rt) return refreshToken(env, azureTenantId);
	return clientCredentialsToken(env, azureTenantId);
}

export class GraphClient {
	private env: ClientEnv;
	private azureTenantId: string;
	private base: string;

	constructor(env: ClientEnv, azureTenantId: string) {
		this.env = env;
		this.azureTenantId = azureTenantId;
		this.base = `${resolveCloud(env).graph}/v1.0`;
	}

	async request<T>(url: string, init: RequestInit = {}): Promise<T> {
		let token = await getToken(this.env, this.azureTenantId);
		let res = await fetch(url, {
			...init,
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
		});
		if (res.status === 401) {
			token = await refreshToken(this.env, this.azureTenantId);
			res = await fetch(url, {
				...init,
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
			});
		}
		if (res.status === 429) {
			const wait = parseInt(res.headers.get('Retry-After') || '5', 10);
			await new Promise((r) => setTimeout(r, wait * 1000));
			return this.request<T>(url, init);
		}
		if (!res.ok) {
			const err = await res.text();
			throw new Error(`Graph API error (${res.status}): ${err}`);
		}
		return res.json() as Promise<T>;
	}

	async fetchAll<T>(url: string): Promise<T[]> {
		const results: T[] = [];
		let next: string | undefined = url;
		while (next) {
			const r = await this.request<GraphResponse<T>>(next);
			results.push(...r.value);
			next = r['@odata.nextLink'];
		}
		return results;
	}

	async fetch(path: string, init?: RequestInit): Promise<any> {
		return this.request(`${this.base}${path}`, init);
	}

	async getUsers(): Promise<GraphUser[]> {
		return this.fetchAll<GraphUser>(
			`${this.base}/users?$select=id,userPrincipalName,displayName,mail,jobTitle,department,accountEnabled,createdDateTime,signInActivity,assignedLicenses&$top=999`,
		);
	}

	async getUser(userId: string): Promise<GraphUser> {
		return this.request<GraphUser>(
			`${this.base}/users/${userId}?$select=id,userPrincipalName,displayName,mail,jobTitle,department,accountEnabled,createdDateTime,signInActivity,assignedLicenses`,
		);
	}

	async getSubscribedSkus(): Promise<GraphSubscribedSku[]> {
		return this.fetchAll<GraphSubscribedSku>(`${this.base}/subscribedSkus`);
	}

	async assignLicense(userId: string, skuId: string): Promise<void> {
		await this.request(`${this.base}/users/${userId}/assignLicense`, {
			method: 'POST',
			body: JSON.stringify({ addLicenses: [{ skuId }], removeLicenses: [] }),
		});
	}

	async removeLicense(userId: string, skuId: string): Promise<void> {
		await this.request(`${this.base}/users/${userId}/assignLicense`, {
			method: 'POST',
			body: JSON.stringify({ addLicenses: [], removeLicenses: [skuId] }),
		});
	}

	async getSecurityAlerts(): Promise<GraphSecurityAlert[]> {
		try {
			const data = await this.request<GraphResponse<GraphSecurityAlert>>(
				`${this.base}/security/alerts_v2?$top=50&$orderby=createdDateTime desc`
			);
			return data.value ?? [];
		} catch { return []; }
	}

	async getAuditLogs(): Promise<any[]> {
		try {
			const data = await this.request<GraphResponse<any>>(
				`${this.base}/auditLogs/signIns?$top=50&$orderby=createdDateTime desc`
			);
			return data.value ?? [];
		} catch { return []; }
	}

	async getMailboxUsage(_period?: string): Promise<any[]> {
		try {
			const data = await this.request<GraphResponse<any>>(
				`${this.base}/reports/getMailboxUsageDetail(period='D7')?$format=application/json`
			);
			return data.value ?? [];
		} catch { return []; }
	}

	async getTeamsActivity(_period?: string): Promise<any[]> {
		try {
			const data = await this.request<GraphResponse<any>>(
				`${this.base}/reports/getTeamsUserActivityUserDetail(period='D7')?$format=application/json`
			);
			return data.value ?? [];
		} catch { return []; }
	}

	async getSharePointActivity(_period?: string): Promise<any[]> {
		try {
			const data = await this.request<GraphResponse<any>>(
				`${this.base}/reports/getSharePointActivityUserDetail(period='D7')?$format=application/json`
			);
			return data.value ?? [];
		} catch { return []; }
	}
}

export function createGraphClient(env: ClientEnv, azureTenantId: string): GraphClient {
	return new GraphClient(env, azureTenantId);
}
