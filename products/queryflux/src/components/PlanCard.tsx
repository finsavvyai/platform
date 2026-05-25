/**
 * Subscription Management — individual plan card component
 */

import { Check, Zap, Rocket, Building2, Crown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatPrice } from '../hooks/subscriptionUtils';
import type { SubscriptionPlan } from '../hooks/subscriptionTypes';

const PLAN_ICONS = { free: Zap, pro: Rocket, business: Building2, enterprise: Crown };

const FEATURE_NAMES: Record<string, string> = {
  aiQueriesEnabled: 'AI Queries', voiceEnabled: 'Voice Commands',
  codeGeneration: 'Code Generation', advancedAnalytics: 'Advanced Analytics',
  prioritySupport: 'Priority Support', customBranding: 'Custom Branding',
  apiAccess: 'API Access', ssoEnabled: 'SSO',
};

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan?: boolean;
  onSelect: () => void;
}

export function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
  const { theme } = useTheme();
  const Icon = PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS];

  return (
    <div
      className={`relative rounded-lg border-2 p-6 transition-all hover:scale-105 ${isCurrentPlan ? 'border-opacity-100' : 'border-opacity-20'}`}
      style={{ borderColor: isCurrentPlan ? theme.colors.accent : theme.colors.border, backgroundColor: isCurrentPlan ? `${theme.colors.accent}10` : theme.colors.background }}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-4 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: theme.colors.accent }}>
          Current Plan
        </div>
      )}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: `${theme.colors.accent}20` }}>
          <Icon size={24} style={{ color: theme.colors.accent }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: theme.colors.text }}>{plan.name}</h3>
          <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{plan.description}</p>
        </div>
      </div>
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: theme.colors.text }}>{formatPrice(plan.price, plan.currency)}</span>
          <span className="text-sm" style={{ color: theme.colors.textSecondary }}>/{plan.interval === 'month' ? 'month' : 'year'}</span>
        </div>
        {plan.trialDays > 0 && <p className="mt-1 text-sm" style={{ color: theme.colors.accent }}>{plan.trialDays} days free trial</p>}
      </div>
      <div className="mb-6 space-y-2">
        {Object.entries(plan.features).map(([key, value]) => {
          if (typeof value !== 'boolean') return null;
          return (
            <div key={key} className="flex items-center gap-2">
              <Check size={16} className={value ? 'text-green-500' : 'text-gray-400'} />
              <span className="text-sm" style={{ color: value ? theme.colors.text : theme.colors.textSecondary, textDecoration: value ? 'none' : 'line-through' }}>
                {FEATURE_NAMES[key] || key}
              </span>
            </div>
          );
        })}
      </div>
      <button onClick={onSelect} disabled={isCurrentPlan}
        className={`w-full rounded-lg px-4 py-2 font-medium transition-all ${isCurrentPlan ? 'cursor-not-allowed bg-gray-700 text-gray-400' : 'hover:scale-105'}`}
        style={!isCurrentPlan ? { backgroundColor: theme.colors.accent, color: 'white' } : undefined}>
        {isCurrentPlan ? 'Current Plan' : plan.price === 0 ? 'Get Started' : 'Upgrade'}
      </button>
    </div>
  );
}
