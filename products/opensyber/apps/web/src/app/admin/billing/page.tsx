import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { CreditCard, TrendingUp } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Admin — Billing' };

interface BillingData {
  mrr: number;
  planDistribution: Record<string, number>;
  recentSubscriptions: Array<{
    userId: string;
    userName: string | null;
    plan: string;
    createdAt: string;
  }>;
}

const planColors: Record<string, string> = {
  free: 'bg-neutral-500/20 text-text-secondary',
  personal: 'bg-signal/20 text-signal',
  pro: 'bg-purple-500/20 text-purple-400',
  team: 'bg-amber-500/20 text-amber-400',
};

export default async function AdminBillingPage() {
  const token = await getApiToken();

  let billing: BillingData = { mrr: 0, planDistribution: {}, recentSubscriptions: [] };
  try {
    if (token) {
      const data = await apiClient<{ data: BillingData }>('/api/admin/billing', { token });
      billing = data.data;
    }
  } catch (err) { console.error('[AdminBilling] Failed to fetch billing data:', err instanceof Error ? err.message : err); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-text-secondary">Revenue metrics and subscription data</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded border border-border bg-panel/30 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <p className="text-sm text-text-secondary">Monthly Recurring Revenue</p>
          </div>
          <p className="text-4xl font-bold text-green-400">${billing.mrr.toLocaleString()}</p>
        </div>

        <div className="rounded border border-border bg-panel/30 p-6">
          <p className="text-sm text-text-secondary mb-3">Plan Distribution</p>
          <div className="space-y-2">
            {Object.entries(billing.planDistribution).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded capitalize ${planColors[plan] ?? planColors.free}`}>
                  {plan}
                </span>
                <span className="text-sm font-medium">{count} users</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Subscriptions</h2>
        {billing.recentSubscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-8 w-8 text-text-dim mb-2" />
            <p className="text-sm text-text-secondary">No recent subscriptions.</p>
          </div>
        ) : (
          <div className="rounded border border-border bg-panel/30 overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Plan</th>
                  <th className="px-6 py-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {billing.recentSubscriptions.map((sub, i) => (
                  <tr key={`${sub.userId}-${i}`} className="hover:bg-surface/30 transition">
                    <td className="px-6 py-3">{sub.userName ?? sub.userId}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${planColors[sub.plan] ?? planColors.free}`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-text-dim">{formatDate(sub.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>
    </div>
  );
}
