/**
 * 🌙 LunaForge Lemon Squeezy Payment Integration
 * 
 * Handles webhooks and subscription verification
 */

import type { Env } from "./providers";

export interface SubscriptionData {
    customerId: string;
    email: string;
    planId: string;
    tier: 'free' | 'professional' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired' | 'past_due';
    subscriptionId: string;
    currentPeriodEnd: string;
    createdAt: string;
    updatedAt: string;
}

export interface WebhookPayload {
    meta: {
        event_name: string;
        custom_data?: Record<string, any>;
    };
    data: {
        id: string;
        type: string;
        attributes: {
            store_id: number;
            customer_id: number;
            order_id?: number;
            product_id: number;
            variant_id: number;
            product_name: string;
            variant_name: string;
            status: string;
            user_email: string;
            user_name?: string;
            renews_at?: string;
            ends_at?: string;
            created_at: string;
            updated_at: string;
            [key: string]: any;
        };
    };
}

// Product ID to tier mapping - actual Lemon Squeezy product IDs
const PRODUCT_TIER_MAP: Record<number, { tier: 'professional' | 'enterprise', planId: string }> = {
    // LunaForge Professional Monthly ($29/mo) - Product ID: 753541
    753541: { tier: 'professional', planId: 'lunaforge-professional-monthly' },
    // LunaForge Professional Yearly ($290/yr) - Product ID: 753552
    753552: { tier: 'professional', planId: 'lunaforge-professional-yearly' },
    // LunaForge Enterprise Monthly ($99/mo) - Product ID: 753558
    753558: { tier: 'enterprise', planId: 'lunaforge-enterprise-monthly' },
    // LunaForge Enterprise Yearly ($990/yr) - Product ID: 753568
    753568: { tier: 'enterprise', planId: 'lunaforge-enterprise-yearly' },
};

/**
 * Verify Lemon Squeezy webhook signature
 */
async function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): Promise<boolean> {
    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signatureBytes = hexToBytes(signature);
        const payloadBytes = encoder.encode(payload);

        return await crypto.subtle.verify('HMAC', key, signatureBytes.buffer as ArrayBuffer, payloadBytes);
    } catch (error) {
        console.error('Signature verification failed:', error);
        return false;
    }
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Handle Lemon Squeezy webhook
 */
export async function handleLemonSqueezyWebhook(
    request: Request,
    env: Env
): Promise<Response> {
    const signature = request.headers.get('x-signature');

    if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const payload = await request.text();
    const secret = env.LEMONSQUEEZY_SIGNING_SECRET;

    if (!secret) {
        console.error('LEMONSQUEEZY_SIGNING_SECRET not configured');
        return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const isValid = await verifyWebhookSignature(payload, signature, secret);

    if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let webhookPayload: WebhookPayload;
    try {
        webhookPayload = JSON.parse(payload);
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const eventName = webhookPayload.meta.event_name;
    console.log(`Processing Lemon Squeezy event: ${eventName}`);

    try {
        switch (eventName) {
            case 'subscription_created':
            case 'subscription_updated':
                await handleSubscriptionCreatedOrUpdated(webhookPayload, env);
                break;
            case 'subscription_cancelled':
                await handleSubscriptionCancelled(webhookPayload, env);
                break;
            case 'subscription_expired':
                await handleSubscriptionExpired(webhookPayload, env);
                break;
            case 'subscription_payment_success':
                await handlePaymentSuccess(webhookPayload, env);
                break;
            case 'subscription_payment_failed':
                await handlePaymentFailed(webhookPayload, env);
                break;
            default:
                console.log(`Unhandled event type: ${eventName}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return new Response(JSON.stringify({ error: 'Processing failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleSubscriptionCreatedOrUpdated(
    payload: WebhookPayload,
    env: Env
): Promise<void> {
    const { attributes } = payload.data;
    const email = attributes.user_email?.toLowerCase();

    if (!email) {
        throw new Error('No email in subscription payload');
    }

    const productId = attributes.product_id;
    const tierInfo = PRODUCT_TIER_MAP[productId];

    // Default to professional if product not mapped
    const tier = tierInfo?.tier || 'professional';
    const planId = tierInfo?.planId || 'lunaforge-professional-monthly';

    const subscriptionData: SubscriptionData = {
        customerId: String(attributes.customer_id),
        email: email,
        planId: planId,
        tier: tier,
        status: attributes.status === 'active' ? 'active' :
            attributes.status === 'cancelled' ? 'cancelled' :
                attributes.status === 'past_due' ? 'past_due' : 'expired',
        subscriptionId: String(payload.data.id),
        currentPeriodEnd: attributes.renews_at || attributes.ends_at || '',
        createdAt: attributes.created_at,
        updatedAt: new Date().toISOString()
    };

    // Store subscription by email (primary key)
    if (env.SUBSCRIPTIONS) {
        await env.SUBSCRIPTIONS.put(
            `email:${email}`,
            JSON.stringify(subscriptionData),
            { expirationTtl: 60 * 60 * 24 * 400 } // 400 days
        );

        // Also store by subscription ID for lookups
        await env.SUBSCRIPTIONS.put(
            `sub:${payload.data.id}`,
            JSON.stringify(subscriptionData),
            { expirationTtl: 60 * 60 * 24 * 400 }
        );

        console.log(`Stored subscription for ${email}: ${tier}`);
    } else {
        console.warn('SUBSCRIPTIONS KV not bound - subscription not stored');
    }
}

async function handleSubscriptionCancelled(
    payload: WebhookPayload,
    env: Env
): Promise<void> {
    const { attributes } = payload.data;
    const email = attributes.user_email?.toLowerCase();

    if (!email || !env.SUBSCRIPTIONS) return;

    const existing = await env.SUBSCRIPTIONS.get(`email:${email}`);
    if (existing) {
        const data: SubscriptionData = JSON.parse(existing);
        data.status = 'cancelled';
        data.updatedAt = new Date().toISOString();

        await env.SUBSCRIPTIONS.put(
            `email:${email}`,
            JSON.stringify(data),
            { expirationTtl: 60 * 60 * 24 * 400 }
        );

        console.log(`Subscription cancelled for ${email}`);
    }
}

async function handleSubscriptionExpired(
    payload: WebhookPayload,
    env: Env
): Promise<void> {
    const { attributes } = payload.data;
    const email = attributes.user_email?.toLowerCase();

    if (!email || !env.SUBSCRIPTIONS) return;

    const existing = await env.SUBSCRIPTIONS.get(`email:${email}`);
    if (existing) {
        const data: SubscriptionData = JSON.parse(existing);
        data.status = 'expired';
        data.updatedAt = new Date().toISOString();

        await env.SUBSCRIPTIONS.put(
            `email:${email}`,
            JSON.stringify(data),
            { expirationTtl: 60 * 60 * 24 * 400 }
        );

        console.log(`Subscription expired for ${email}`);
    }
}

async function handlePaymentSuccess(
    payload: WebhookPayload,
    env: Env
): Promise<void> {
    console.log('Payment successful:', payload.data.id);
    // Update subscription status to active if it was past_due
    await handleSubscriptionCreatedOrUpdated(payload, env);
}

async function handlePaymentFailed(
    payload: WebhookPayload,
    env: Env
): Promise<void> {
    const { attributes } = payload.data;
    const email = attributes.user_email?.toLowerCase();

    if (!email || !env.SUBSCRIPTIONS) return;

    const existing = await env.SUBSCRIPTIONS.get(`email:${email}`);
    if (existing) {
        const data: SubscriptionData = JSON.parse(existing);
        data.status = 'past_due';
        data.updatedAt = new Date().toISOString();

        await env.SUBSCRIPTIONS.put(
            `email:${email}`,
            JSON.stringify(data),
            { expirationTtl: 60 * 60 * 24 * 400 }
        );

        console.log(`Payment failed for ${email}`);
    }
}

/**
 * Verify subscription status by email
 */
export async function verifySubscription(
    request: Request,
    env: Env
): Promise<Response> {
    let body: { email?: string };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const email = body.email?.toLowerCase();

    if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!env.SUBSCRIPTIONS) {
        // Fallback for development - allow LF- prefix keys
        return new Response(JSON.stringify({
            isActive: false,
            tier: 'free',
            message: 'Subscription storage not configured'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const stored = await env.SUBSCRIPTIONS.get(`email:${email}`);

    if (!stored) {
        return new Response(JSON.stringify({
            isActive: false,
            tier: 'free'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const data: SubscriptionData = JSON.parse(stored);
    const isActive = data.status === 'active';

    return new Response(JSON.stringify({
        isActive,
        tier: isActive ? data.tier : 'free',
        planId: data.planId,
        expiresAt: data.currentPeriodEnd,
        status: data.status
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
