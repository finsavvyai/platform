import { useEffect, useRef } from 'react';
import BillingPlanCard from './BillingPlanCard';

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, team: 2 };

export const PLANS = [
  {
    id: 'free', name: 'Free', price: '$0', period: 'forever',
    features: ['Unlimited local runs', 'AI stack detection', '2 deploy targets', 'Community support'],
  },
  {
    id: 'pro', name: 'Pro', price: '$9', period: '/mo',
    features: ['Unlimited repositories', 'AI diagnosis (100/mo)', '500 cloud minutes', '22 deploy targets', 'Web dashboard + analytics', 'Slack & Discord alerts', 'Priority support'],
    highlight: true,
  },
  {
    id: 'team', name: 'Team', price: '$29', period: '/seat/mo',
    features: ['Everything in Pro', '2000 cloud minutes', 'Up to 25 members', 'SSO / SAML', 'Audit logs', 'Governance workflows', 'SLA guarantee'],
  },
];

interface BillingCardsProps {
  currentPlan: string;
  loading: string | null;
  upgradePlan: string | null;
  onCheckout: (planId: string) => void;
}

export default function BillingCards({ currentPlan, loading, upgradePlan, onCheckout }: BillingCardsProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const currentRank = PLAN_RANK[currentPlan] ?? 0;

  useEffect(() => {
    if (upgradePlan && cardRefs.current[upgradePlan]) {
      cardRefs.current[upgradePlan]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [upgradePlan]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 md:items-start">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          ref={(el) => { cardRefs.current[plan.id] = el; }}
          className={plan.highlight ? 'md:-mt-3 md:mb-3' : ''}
        >
          <BillingPlanCard
            plan={plan}
            isCurrent={plan.id === currentPlan}
            isBelowCurrent={(PLAN_RANK[plan.id] ?? 0) < currentRank}
            isTarget={upgradePlan === plan.id}
            loading={loading === plan.id}
            onCheckout={() => onCheckout(plan.id)}
          />
        </div>
      ))}
    </div>
  );
}
