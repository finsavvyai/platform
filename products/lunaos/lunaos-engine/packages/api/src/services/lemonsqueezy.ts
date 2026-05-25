/** LemonSqueezy Service — raw fetch, Cloudflare Worker-compatible */

export interface LSConfig {
    apiKey: string;
    storeId: string;
    webhookSecret: string;
    variantIds: { pro: string; team: string };
}

const LS_API = 'https://api.lemonsqueezy.com/v1';

async function lsRequest(
    path: string,
    apiKey: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>,
): Promise<any> {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json',
    };

    let reqBody: string | undefined;
    if (body) {
        headers['Content-Type'] = 'application/vnd.api+json';
        reqBody = JSON.stringify(body);
    }

    const res = await fetch(`${LS_API}${path}`, { method, headers, body: reqBody });
    const data = await res.json() as any;

    if (!res.ok) {
        throw new Error(`LemonSqueezy error (${res.status}): ${JSON.stringify(data.errors || data)}`);
    }
    return data;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export async function createCheckout(
    config: LSConfig,
    params: { userId: string; email: string; tier: 'pro' | 'team'; redirectUrl: string },
): Promise<{ url: string }> {
    const variantId = config.variantIds[params.tier];
    if (!variantId) throw new Error(`No variant configured for tier: ${params.tier}`);

    const data = await lsRequest('/checkouts', config.apiKey, 'POST', {
        data: {
            type: 'checkouts',
            attributes: {
                checkout_data: {
                    email: params.email,
                    custom: { user_id: params.userId, tier: params.tier },
                },
                checkout_options: { embed: false },
                product_options: {
                    redirect_url: params.redirectUrl,
                    receipt_button_text: 'Go to Dashboard',
                    receipt_thank_you_note: `Welcome to LunaOS ${params.tier}!`,
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

// ─── Webhook Signature Verification ─────────────────────────────────────────

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

    const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(payload),
    );

    const expected = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
        result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
}

// ─── Subscription Management ─────────────────────────────────────────────────

export async function cancelSubscription(
    apiKey: string,
    subscriptionId: string,
): Promise<any> {
    return lsRequest(`/subscriptions/${subscriptionId}`, apiKey, 'DELETE');
}

export async function getSubscription(
    apiKey: string,
    subscriptionId: string,
): Promise<any> {
    return lsRequest(`/subscriptions/${subscriptionId}`, apiKey);
}

/** Map LS variant ID to tier name */
export function tierFromVariantId(variantId: string, config: LSConfig): string {
    if (variantId === config.variantIds.pro) return 'pro';
    if (variantId === config.variantIds.team) return 'team';
    return 'free';
}
