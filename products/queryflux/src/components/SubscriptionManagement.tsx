/**
 * Subscription Management Component
 *
 * UI for managing subscriptions, billing, and plans
 */

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import {
  useSubscriptionManagement,
  getPlanComparison,
  isActiveSubscription,
  getStatusColor,
  getStatusText,
  getTrialDaysRemaining,
} from '../hooks/useSubscriptionManagement';
import { PlanCard } from './PlanCard';
import { PlanComparisonTable } from './PlanComparisonTable';

interface SubscriptionManagementProps {
  teamId?: string;
  onUpgrade?: (planId: string) => void;
}

export function SubscriptionManagement({ teamId, onUpgrade: _onUpgrade }: SubscriptionManagementProps) {
  const { theme } = useTheme();
  const [showYearly, setShowYearly] = useState(false);
  const { subscription, plans, createCheckout } = useSubscriptionManagement(teamId);
  const isActive = isActiveSubscription(subscription);
  const trialDaysRemaining = getTrialDaysRemaining(subscription);
  const planComparison = getPlanComparison();

  const handlePlanSelect = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    await createCheckout({ variantId: plan.lemonSqueezyVariantId, customData: { teamId: teamId || '' } });
  };

  return (
    <div className="space-y-6">
      {subscription && isActive && (
        <div className="rounded-lg border p-4" style={{ borderColor: theme.colors.accent, backgroundColor: `${theme.colors.accent}10` }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>Current Plan: {subscription.planName}</h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Status: <span className="font-medium" style={{ color: getStatusColor(subscription.status) }}>{getStatusText(subscription.status)}</span>
                {subscription.status === 'trialing' && <span className="ml-2">({trialDaysRemaining} days remaining)</span>}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${theme.colors.accent}20` }}>
              <CreditCard size={20} style={{ color: theme.colors.accent }} />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${!showYearly ? 'text-blue-600' : 'text-gray-400'}`}>Monthly</span>
        <button onClick={() => setShowYearly(!showYearly)} className={`relative h-6 w-11 rounded-full transition-colors ${showYearly ? 'bg-blue-600' : 'bg-gray-600'}`}>
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${showYearly ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${showYearly ? 'text-blue-600' : 'text-gray-400'}`}>
          Yearly <span className="ml-1 text-xs text-green-500">(Save 20%)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} isCurrentPlan={subscription?.planId === plan.id} onSelect={() => handlePlanSelect(plan.id)} />
        ))}
      </div>

      <PlanComparisonTable plans={planComparison} />
    </div>
  );
}
