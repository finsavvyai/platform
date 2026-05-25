import { describe, it, expect, vi } from 'vitest';
import {
    parseLSEvent,
    handleSubscriptionCreated,
    handleSubscriptionCancelled,
    handleSubscriptionExpired,
    handlePaymentFailed,
} from './billing-webhook-handlers';
import type { LSConfig } from './lemonsqueezy';

const config: LSConfig = {
    apiKey: 'test_key',
    storeId: '12345',
    webhookSecret: 'secret',
    variantIds: { pro: 'var_pro', team: 'var_team' },
};

function mockEnv() {
    const run = vi.fn().mockResolvedValue({});
    const first = vi.fn().mockResolvedValue(null);
    return {
        DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run, first })), run, first })) },
        RESEND_API_KEY: '',
    } as any;
}

describe('parseLSEvent', () => {
    it('extracts event fields from LS webhook body', () => {
        const body = {
            meta: { event_name: 'subscription_created', custom_data: { user_id: 'u1' } },
            data: {
                id: 'sub_1',
                attributes: { customer_id: 42, variant_id: 99, status: 'active', renews_at: '2026-04-01' },
            },
        };
        const event = parseLSEvent(body);
        expect(event.eventName).toBe('subscription_created');
        expect(event.customData.user_id).toBe('u1');
        expect(event.subscriptionId).toBe('sub_1');
        expect(event.customerId).toBe('42');
        expect(event.variantId).toBe('99');
        expect(event.status).toBe('active');
    });
});

describe('handleSubscriptionCreated', () => {
    it('inserts subscription and updates user tier', async () => {
        const env = mockEnv();
        const event = parseLSEvent({
            meta: { event_name: 'subscription_created', custom_data: { user_id: 'u1' } },
            data: { id: 'sub_1', attributes: { customer_id: 5, variant_id: 'var_pro', status: 'active' } },
        });
        await handleSubscriptionCreated(env, event, config);
        expect(env.DB.prepare).toHaveBeenCalled();
    });

    it('skips when userId is missing', async () => {
        const env = mockEnv();
        const event = parseLSEvent({
            meta: { event_name: 'subscription_created', custom_data: {} },
            data: { id: 'sub_1', attributes: {} },
        });
        await handleSubscriptionCreated(env, event, config);
    });
});

describe('handleSubscriptionCancelled', () => {
    it('marks subscription as cancelled', async () => {
        const env = mockEnv();
        const event = parseLSEvent({
            meta: { event_name: 'subscription_cancelled' },
            data: { id: 'sub_1', attributes: { status: 'cancelled' } },
        });
        await handleSubscriptionCancelled(env, event);
        expect(env.DB.prepare).toHaveBeenCalled();
    });
});

describe('handleSubscriptionExpired', () => {
    it('reverts user to free tier', async () => {
        const env = mockEnv();
        const first = vi.fn().mockResolvedValue({ user_id: 'u1' });
        env.DB.prepare = vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(), first })) }));
        const event = parseLSEvent({
            meta: { event_name: 'subscription_expired' },
            data: { id: 'sub_1', attributes: {} },
        });
        await handleSubscriptionExpired(env, event);
        expect(env.DB.prepare).toHaveBeenCalled();
    });
});

describe('handlePaymentFailed', () => {
    it('marks subscription as past_due', async () => {
        const env = mockEnv();
        const event = parseLSEvent({
            meta: { event_name: 'subscription_payment_failed' },
            data: { id: 'sub_1', attributes: {} },
        });
        await handlePaymentFailed(env, event);
        expect(env.DB.prepare).toHaveBeenCalled();
    });
});
