import { apiFetch } from './client';

export interface Subscription {
    id: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
}

export interface Usage {
    tier: string;
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    period: { start: string; end: string };
}

export const billingApi = {
    checkout: async (tier: 'pro' | 'team') => {
        const res = await apiFetch('/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ tier }),
        });
        return res.json() as Promise<{ checkoutUrl: string }>;
    },

    subscription: async () => {
        const res = await apiFetch('/billing/subscription');
        return res.json() as Promise<{ tier: string; status: string; subscription: Subscription | null }>;
    },

    usage: async () => {
        const res = await apiFetch('/billing/usage');
        return res.json() as Promise<Usage>;
    },

    cancel: async () => {
        const res = await apiFetch('/billing/cancel', { method: 'POST' });
        return res.json();
    },
};
