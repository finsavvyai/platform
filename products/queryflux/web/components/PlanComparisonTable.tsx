/**
 * Subscription Management — plan feature comparison table
 */

import { Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatPrice } from '../hooks/subscriptionUtils';
import type { SubscriptionPlan } from '../hooks/subscriptionTypes';

interface PlanComparisonTableProps {
  plans: { free: SubscriptionPlan; pro: SubscriptionPlan; business: SubscriptionPlan; enterprise: SubscriptionPlan };
}

function FeatureCell({ value }: { value: boolean }) {
  return value
    ? <Check size={16} className="mx-auto text-green-500" />
    : <span className="text-gray-400">—</span>;
}

export function PlanComparisonTable({ plans }: PlanComparisonTableProps) {
  const { theme } = useTheme();
  const { free, pro, business, enterprise } = plans;
  const fmt = (p: SubscriptionPlan) => formatPrice(p.price, p.currency);
  const lim = (v: number) => v === -1 ? '∞' : v;

  const rows = [
    { label: 'Price', cells: [fmt(free), fmt(pro), fmt(business), fmt(enterprise)], type: 'text' },
    { label: 'Teams', cells: [lim(free.features.maxTeams), lim(pro.features.maxTeams), lim(business.features.maxTeams), 'Unlimited'], type: 'text' },
    { label: 'Members per Team', cells: [lim(free.features.maxMembersPerTeam), lim(pro.features.maxMembersPerTeam), lim(business.features.maxMembersPerTeam), 'Unlimited'], type: 'text' },
    { label: 'Queries/Month', cells: [lim(free.features.maxQueriesPerMonth), lim(pro.features.maxQueriesPerMonth), lim(business.features.maxQueriesPerMonth), 'Unlimited'], type: 'text' },
    { label: 'AI Queries', cells: [free.features.aiQueriesEnabled, pro.features.aiQueriesEnabled, business.features.aiQueriesEnabled, enterprise.features.aiQueriesEnabled], type: 'bool' },
    { label: 'Voice Commands', cells: [free.features.voiceEnabled, pro.features.voiceEnabled, business.features.voiceEnabled, enterprise.features.voiceEnabled], type: 'bool' },
    { label: 'Code Generation', cells: [free.features.codeGeneration, pro.features.codeGeneration, business.features.codeGeneration, enterprise.features.codeGeneration], type: 'bool' },
    { label: 'SSO', cells: [free.features.ssoEnabled, pro.features.ssoEnabled, business.features.ssoEnabled, enterprise.features.ssoEnabled], type: 'bool' },
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: theme.colors.border }}>
      <table className="w-full">
        <thead>
          <tr className="border-b" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
            {['Feature', 'Free', 'Pro', 'Business', 'Enterprise'].map((h) => (
              <th key={h} className={`px-4 py-3 text-sm font-semibold ${h === 'Feature' ? 'text-left' : 'text-center'}`} style={{ color: theme.colors.text }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, cells, type }, i) => (
            <tr key={label} className={i < rows.length - 1 ? 'border-b' : ''} style={{ borderColor: theme.colors.border }}>
              <td className="px-4 py-3 text-sm" style={{ color: theme.colors.text }}>{label}</td>
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-center text-sm" style={{ color: j === 1 ? theme.colors.accent : theme.colors.text }}>
                  {type === 'bool' ? <FeatureCell value={cell as boolean} /> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
