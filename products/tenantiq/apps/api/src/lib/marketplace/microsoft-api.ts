/**
 * Microsoft Commercial Marketplace API client.
 * Validates tokens against Microsoft (no offline JWT verify — Microsoft's resolve
 * endpoint is the authoritative oracle and rotates frequently).
 *
 * Resource ID: 20e940b3-4c77-4b0b-9a53-9e16a1b010a7 (Microsoft Marketplace SaaS API).
 */

const RESOURCE_ID = '20e940b3-4c77-4b0b-9a53-9e16a1b010a7';
const RESOLVE_URL = 'https://marketplaceapi.microsoft.com/api/saas/subscriptions/resolve?api-version=2018-08-31';
const OPERATIONS_BASE = 'https://marketplaceapi.microsoft.com/api/saas/subscriptions';
const TOKEN_KV_TTL = 50 * 60; // 50 min — Azure tokens last 60 min

export interface ResolvedSubscription {
	id: string;
	subscriptionName: string;
	offerId: string;
	planId: string;
	quantity: number;
	subscription: { id: string; saasSubscriptionStatus: string; beneficiary?: { tenantId?: string; emailId?: string } };
}

export interface MicrosoftEnv {
	KV: KVNamespace;
	MARKETPLACE_PUBLISHER_TENANT_ID?: string;
	MARKETPLACE_AAD_APP_ID?: string;
	MARKETPLACE_AAD_APP_SECRET?: string;
}

/** Get cached or fresh marketplace API access token (client_credentials flow). */
export async function getMarketplaceApiToken(env: MicrosoftEnv, fetchImpl: typeof fetch = fetch): Promise<string | null> {
	if (!env.MARKETPLACE_PUBLISHER_TENANT_ID || !env.MARKETPLACE_AAD_APP_ID || !env.MARKETPLACE_AAD_APP_SECRET) {
		return null; // not configured — marketplace integration off
	}

	const cacheKey = 'marketplace-api-token';
	const cached = await env.KV.get(cacheKey);
	if (cached) return cached;

	const tokenUrl = `https://login.microsoftonline.com/${env.MARKETPLACE_PUBLISHER_TENANT_ID}/oauth2/v2.0/token`;
	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: env.MARKETPLACE_AAD_APP_ID,
		client_secret: env.MARKETPLACE_AAD_APP_SECRET,
		scope: `${RESOURCE_ID}/.default`,
	});

	const res = await fetchImpl(tokenUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
	if (!res.ok) return null;

	const json = (await res.json()) as { access_token?: string; expires_in?: number };
	if (!json.access_token) return null;

	await env.KV.put(cacheKey, json.access_token, { expirationTtl: TOKEN_KV_TTL });
	return json.access_token;
}

/** Resolve a user-supplied marketplace token (from landing-page redirect) to a subscription. */
export async function resolveMarketplaceToken(
	env: MicrosoftEnv,
	userToken: string,
	fetchImpl: typeof fetch = fetch,
): Promise<ResolvedSubscription | null> {
	const apiToken = await getMarketplaceApiToken(env, fetchImpl);
	if (!apiToken) return null;

	const res = await fetchImpl(RESOLVE_URL, {
		method: 'POST',
		headers: {
			'x-ms-marketplace-token': userToken,
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
	});
	if (!res.ok) return null;
	return (await res.json()) as ResolvedSubscription;
}

/** Verify that a webhook subscription+operation actually exists in Microsoft's records. */
export async function verifyWebhookOperation(
	env: MicrosoftEnv,
	subscriptionId: string,
	operationId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
	const apiToken = await getMarketplaceApiToken(env, fetchImpl);
	if (!apiToken) return false;

	const url = `${OPERATIONS_BASE}/${encodeURIComponent(subscriptionId)}/operations/${encodeURIComponent(operationId)}?api-version=2018-08-31`;
	const res = await fetchImpl(url, {
		headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
	});
	return res.ok;
}

/** Acknowledge an operation back to Microsoft (PATCH with status). */
export async function acknowledgeOperation(
	env: MicrosoftEnv,
	subscriptionId: string,
	operationId: string,
	planId: string,
	quantity: number,
	status: 'Success' | 'Failure',
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
	const apiToken = await getMarketplaceApiToken(env, fetchImpl);
	if (!apiToken) return false;

	const url = `${OPERATIONS_BASE}/${encodeURIComponent(subscriptionId)}/operations/${encodeURIComponent(operationId)}?api-version=2018-08-31`;
	const res = await fetchImpl(url, {
		method: 'PATCH',
		headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ status, planId, quantity }),
	});
	return res.ok;
}
