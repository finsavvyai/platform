/**
 * LunaOS Billing Page — Unit Tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BillingPage from '../page';

jest.mock('../../../../lib/api', () => ({
    billingApi: {
        usage: jest.fn(),
        subscription: jest.fn(),
        checkout: jest.fn(),
        cancel: jest.fn(),
    },
}));

import { billingApi } from '../../../../lib/api';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/dashboard/billing',
    useSearchParams: () => new URLSearchParams(),
}));

const mockUsage = {
    used: 42,
    limit: 100,
    remaining: 58,
    percentUsed: 42,
    period: {
        start: '2026-03-01T00:00:00Z',
        end: '2026-03-31T23:59:59Z',
    },
};

const mockSubscription = {
    tier: 'free',
    status: 'active',
    subscription: null,
};

const mockProSubscription = {
    tier: 'pro',
    status: 'active',
    subscription: {
        id: 'sub_123',
        currentPeriodEnd: '2026-04-01T00:00:00Z',
        cancelAtPeriodEnd: false,
    },
};

describe('BillingPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (billingApi.usage as jest.Mock).mockResolvedValue(mockUsage);
        (billingApi.subscription as jest.Mock).mockResolvedValue(mockSubscription);
    });

    test('shows loading state initially', () => {
        (billingApi.usage as jest.Mock).mockReturnValue(new Promise(() => { }));
        (billingApi.subscription as jest.Mock).mockReturnValue(new Promise(() => { }));
        render(<BillingPage />);
        expect(screen.getByText('Loading billing...')).toBeInTheDocument();
    });

    test('renders page header after load', async () => {
        render(<BillingPage />);
        await waitFor(() => {
            expect(screen.getByText('Billing & Usage')).toBeInTheDocument();
            expect(screen.getByText('Manage your subscription and monitor usage')).toBeInTheDocument();
        });
    });

    test('fetches usage and subscription on mount', async () => {
        render(<BillingPage />);
        await waitFor(() => {
            expect(billingApi.usage).toHaveBeenCalledTimes(1);
            expect(billingApi.subscription).toHaveBeenCalledTimes(1);
        });
    });

    test('renders Current Plan section for free tier', async () => {
        render(<BillingPage />);
        await waitFor(() => {
            expect(screen.getByText('Current Plan')).toBeInTheDocument();
            expect(screen.getByText('free')).toBeInTheDocument();
        });
    });

    test('renders usage section with correct numbers', async () => {
        render(<BillingPage />);
        await waitFor(() => {
            expect(screen.getByText('Monthly Usage')).toBeInTheDocument();
            expect(screen.getByText('42')).toBeInTheDocument(); // used
            expect(screen.getByText('42% used')).toBeInTheDocument();
        });
    });

    test('shows upgrade buttons on free plan', async () => {
        render(<BillingPage />);
        await waitFor(() => {
            expect(screen.getByText('Upgrade to Pro — $29/mo')).toBeInTheDocument();
            expect(screen.getByText('Team — $79/mo')).toBeInTheDocument();
        });
    });

    test('shows active subscription details for pro tier', async () => {
        (billingApi.subscription as jest.Mock).mockResolvedValue(mockProSubscription);
        render(<BillingPage />);
        await waitFor(() => {
            expect(screen.getByText('pro')).toBeInTheDocument();
            expect(screen.getByText('Manage Billing')).toBeInTheDocument();
            expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
        });
    });

    test('handles API error gracefully', async () => {
        (billingApi.usage as jest.Mock).mockRejectedValue(new Error('API error'));
        (billingApi.subscription as jest.Mock).mockRejectedValue(new Error('API error'));
        render(<BillingPage />);
        // Should not crash — loading finishes
        await waitFor(() => {
            expect(screen.queryByText('Loading billing...')).not.toBeInTheDocument();
        });
    });

    test('calls checkout with correct tier on upgrade click', async () => {
        (billingApi.checkout as jest.Mock).mockResolvedValue({ checkoutUrl: 'https://lunaos.lemonsqueezy.com/checkout/buy/var_pro' });
        // Mock window.location.href
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...originalLocation, href: '' },
        });

        render(<BillingPage />);
        await waitFor(() => {
            expect(screen.getByText('Upgrade to Pro — $29/mo')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Upgrade to Pro — $29/mo'));
        await waitFor(() => {
            expect(billingApi.checkout).toHaveBeenCalledWith('pro');
        });

        window.location = originalLocation;
    });
});
