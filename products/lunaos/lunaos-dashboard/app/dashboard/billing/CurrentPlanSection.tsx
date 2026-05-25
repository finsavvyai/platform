'use client';

import { type Subscription } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';

interface SubscriptionData {
    tier: string;
    status: string;
    subscription: Subscription | null;
}

interface CurrentPlanSectionProps {
    subscription: SubscriptionData;
    actionLoading: string;
    onUpgrade: (tier: 'pro' | 'team') => void;
    onCancel: () => void;
    onPortal: () => void;
}

const tierColors: Record<string, string> = {
    free: 'text-neutral-400 border-neutral-700 bg-neutral-800/50',
    pro: 'text-violet-400 border-violet-500/30 bg-violet-500/5',
    team: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
};

export default function CurrentPlanSection({
    subscription,
    actionLoading,
    onUpgrade,
    onCancel,
    onPortal,
}: CurrentPlanSectionProps) {
    return (
        <div className="neon-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Current Plan</h2>
                <span className={`px-3 py-1 rounded-full border text-sm font-medium capitalize ${tierColors[subscription.tier || 'free']}`}>
                    {subscription.tier || 'free'}
                </span>
            </div>

            {subscription.subscription ? (
                <ActiveSubscriptionDetails
                    subscription={subscription}
                    actionLoading={actionLoading}
                    onCancel={onCancel}
                    onPortal={onPortal}
                />
            ) : (
                <FreePlanUpgrade actionLoading={actionLoading} onUpgrade={onUpgrade} />
            )}
        </div>
    );
}

function ActiveSubscriptionDetails({
    subscription,
    actionLoading,
    onCancel,
    onPortal,
}: {
    subscription: SubscriptionData;
    actionLoading: string;
    onCancel: () => void;
    onPortal: () => void;
}) {
    const sub = subscription.subscription;
    if (!sub) return null;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="text-neutral-500">Status</span>
                    <p className="text-white capitalize">{subscription.status}</p>
                </div>
                <div>
                    <span className="text-neutral-500">Renews</span>
                    <p className="text-white">
                        {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                </div>
            </div>

            {sub.cancelAtPeriodEnd && (
                <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
                    <AlertTriangle className="w-4 h-4 inline mr-1.5 shrink-0" aria-hidden="true" />
                    Your subscription will cancel at the end of the current billing period.
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    onClick={onPortal}
                    disabled={!!actionLoading}
                    className="btn btn-secondary text-sm"
                >
                    {actionLoading === 'portal' ? 'Opening...' : 'Manage Billing'}
                </button>
                {!sub.cancelAtPeriodEnd && (
                    <button
                        onClick={onCancel}
                        disabled={!!actionLoading}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                        {actionLoading === 'cancel' ? 'Canceling...' : 'Cancel Subscription'}
                    </button>
                )}
            </div>
        </div>
    );
}

function FreePlanUpgrade({
    actionLoading,
    onUpgrade,
}: {
    actionLoading: string;
    onUpgrade: (tier: 'pro' | 'team') => void;
}) {
    return (
        <div className="space-y-4">
            <p className="text-neutral-400 text-sm">
                You&apos;re on the free plan. Upgrade to Pro for managed AI keys and 33 pre-configured MCP servers.
            </p>
            <div className="flex gap-3">
                <button
                    onClick={() => onUpgrade('pro')}
                    disabled={!!actionLoading}
                    className="btn btn-primary text-sm"
                >
                    {actionLoading === 'upgrade-pro' ? 'Opening checkout...' : 'Upgrade to Pro — $29/mo'}
                </button>
                <button
                    onClick={() => onUpgrade('team')}
                    disabled={!!actionLoading}
                    className="btn btn-secondary text-sm"
                >
                    {actionLoading === 'upgrade-team' ? 'Opening checkout...' : 'Team — $79/mo'}
                </button>
            </div>
        </div>
    );
}
