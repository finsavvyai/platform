/** LemonSqueezy Service — raw fetch, Cloudflare Worker-compatible */

export interface LSConfig {
	apiKey: string;
	storeId: string;
	webhookSecret: string;
	variantIds: {
		core: string;
		professional: string;
		security_suite: string;
		enterprise: string;
	};
	annualVariantIds?: {
		core?: string;
		professional?: string;
		security_suite?: string;
	};
}

export type TenantIQTier = 'core' | 'professional' | 'security_suite' | 'enterprise';

const LS_API = 'https://api.lemonsqueezy.com/v1';

async function lsRequest(
	path: string,
	apiKey: string,
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
	body?: Record<string, unknown>,
): Promise<any> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
		Accept: 'application/vnd.api+json',
	};

	let reqBody: string | undefined;
	if (body) {
		headers['Content-Type'] = 'application/vnd.api+json';
		reqBody = JSON.stringify(body);
	}

	const res = await fetch(`${LS_API}${path}`, { method, headers, body: reqBody });
	const data = (await res.json()) as any;

	if (!res.ok) {
		throw new Error(`LemonSqueezy error (${res.status}): ${JSON.stringify(data.errors || data)}`);
	}
	return data;
}

// --- Checkout ----------------------------------------------------------------

export async function createCheckout(
	config: LSConfig,
	params: { orgId: string; email: string; tier: TenantIQTier; cycle?: 'monthly' | 'annual' },
): Promise<{ url: string }> {
	const isAnnual = params.cycle === 'annual';
	const annualId = isAnnual && params.tier !== 'enterprise'
		? config.annualVariantIds?.[params.tier as 'core' | 'professional' | 'security_suite']
		: undefined;
	const variantId = annualId || config.variantIds[params.tier];
	if (!variantId) throw new Error(`No variant configured for tier: ${params.tier}`);

	const data = await lsRequest('/checkouts', config.apiKey, 'POST', {
		data: {
			type: 'checkouts',
			attributes: {
				checkout_data: {
					email: params.email,
					custom: { org_id: params.orgId, tier: params.tier },
				},
				checkout_options: { embed: false },
				product_options: {
					redirect_url: 'https://app.tenantiq.app/settings?tab=billing&success=true',
					receipt_button_text: 'Go to Dashboard',
					receipt_thank_you_note: `Welcome to TenantIQ ${params.tier}!`,
				},
			},
			relationships: {
				store: { data: { type: 'stores', id: config.storeId } },
				variant: { data: { type: 'variants', id: variantId } },
			},
		},
	});

	return { url: data.data.attributes.url };
}

// --- Webhook Signature Verification ------------------------------------------

export async function verifyWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

	const expected = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	// Constant-time compare — length-guard first, then XOR accumulate.
	if (expected.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) {
		diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return diff === 0;
}

// --- Subscription Management -------------------------------------------------

export async function cancelSubscription(apiKey: string, subscriptionId: string): Promise<any> {
	return lsRequest(`/subscriptions/${subscriptionId}`, apiKey, 'DELETE');
}

export async function getSubscription(apiKey: string, subscriptionId: string): Promise<any> {
	return lsRequest(`/subscriptions/${subscriptionId}`, apiKey);
}

/** Map LS variant ID to tier name */
export function tierFromVariantId(variantId: string, config: LSConfig): TenantIQTier | 'free' {
	if (variantId === config.variantIds.core) return 'core';
	if (variantId === config.variantIds.professional) return 'professional';
	if (variantId === config.variantIds.security_suite) return 'security_suite';
	if (variantId === config.variantIds.enterprise) return 'enterprise';
	// Check annual variants
	if (variantId === config.annualVariantIds?.core) return 'core';
	if (variantId === config.annualVariantIds?.professional) return 'professional';
	if (variantId === config.annualVariantIds?.security_suite) return 'security_suite';
	return 'free';
}
