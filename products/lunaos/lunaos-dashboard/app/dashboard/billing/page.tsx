'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { billingApi, type Usage, type Subscription } from '@/lib/api';
import CurrentPlanSection from './CurrentPlanSection';
import UsageSection from './UsageSection';
import { AlertTriangle } from 'lucide-react';

interface SubscriptionData {
    tier: string;
    status: string;
    subscription: Subscription | null;
}

export default function BillingPage() {
    const [usage, setUsage] = useState<Usage | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');
    const [error, setError] = useState<string | null>(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (loading) return;
        const upgradeTier = searchParams.get('upgrade');
        if (upgradeTier === 'pro' || upgradeTier === 'team') {
            handleUpgrade(upgradeTier);
        }
    }, [loading, searchParams]);

    async function loadData() {
        setLoading(true);
        setError(null);
        try {
            const [usageData, subData] = await Promise.all([
                billingApi.usage(),
                billingApi.subscription(),
            ]);
            setUsage(usageData);
            setSubscription(subData);
        } catch {
            setError('Failed to load billing data. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    }

    async function handleUpgrade(tier: 'pro' | 'team') {
        setActionLoading(`upgrade-${tier}`);
        setError(null);
        try {
            const { checkoutUrl } = await billingApi.checkout(tier);
            if (typeof window !== 'undefined' && (window as any).LemonSqueezy) {
                (window as any).LemonSqueezy.Url.Open(checkoutUrl);
            } else {
                window.open(checkoutUrl, '_blank');
            }
        } catch {
            setError('Failed to start checkout. Please try again.');
        } finally {
            setActionLoading('');
        }
    }

    async function handleCancel() {
        if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) return;
        setActionLoading('cancel');
        setError(null);
        try {
            await billingApi.cancel();
            await loadData();
        } catch {
            setError('Failed to cancel subscription. Please try again.');
        } finally {
            setActionLoading('');
        }
    }

    function handlePortal() {
        const portalUrl = 'https://lunaos.lemonsqueezy.com/billing';
        if (typeof window !== 'undefined' && (window as any).LemonSqueezy) {
            (window as any).LemonSqueezy.Url.Open(portalUrl);
        } else {
            window.open(portalUrl, '_blank');
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-pulse text-neutral-400">Loading billing...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white">Billing & Usage</h1>
                <p className="text-neutral-400 mt-1">Manage your subscription and monitor usage</p>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {error}
                </div>
            )}

            {subscription && (
                <CurrentPlanSection
                    subscription={subscription}
                    actionLoading={actionLoading}
                    onUpgrade={handleUpgrade}
                    onCancel={handleCancel}
                    onPortal={handlePortal}
                />
            )}

            {usage && <UsageSection usage={usage} />}
        </div>
    );
}
