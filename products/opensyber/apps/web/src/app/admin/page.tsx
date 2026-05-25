import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Users, Server, Building2, Activity, TrendingUp, UserPlus, BriefcaseBusiness, ArrowUpRight } from 'lucide-react';
import type { AdminStats } from '@opensyber/shared';

export const metadata = { title: 'Admin Dashboard' };

const statCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'text-signal' },
  { key: 'totalInstances', label: 'Total Instances', icon: Server, color: 'text-green-400' },
  { key: 'totalOrgs', label: 'Organizations', icon: Building2, color: 'text-purple-400' },
  { key: 'totalEvents', label: 'Security Events', icon: Activity, color: 'text-amber-400' },
] as const;

export default async function AdminDashboardPage() {
  const token = await getApiToken();

  let stats: AdminStats = {
    totalUsers: 0, totalInstances: 0, totalOrgs: 0, totalEvents: 0, activeInstances: 0,
    trustFunnel: {
      totalLeads: 0,
      recentLeads7d: 0,
      trustPageViews: 0,
      recentViews7d: 0,
      trustTrialStarts: 0,
      trustSignupViews: 0,
      trustDemoRequests: 0,
      topSources: [],
    },
  };

  try {
    if (token) {
      const data = await apiClient<{ data: AdminStats }>('/api/admin/stats', { token });
      stats = data.data;
    }
  } catch {
    // API not available
  }

  const trustToTrialRate = stats.trustFunnel.trustPageViews > 0
    ? Math.round((stats.trustFunnel.trustTrialStarts / stats.trustFunnel.trustPageViews) * 100)
    : 0;
  const trustToSignupRate = stats.trustFunnel.trustPageViews > 0
    ? Math.round((stats.trustFunnel.trustSignupViews / stats.trustFunnel.trustPageViews) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Platform overview and key metrics</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="rounded border border-border bg-panel/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-text-secondary">{label}</p>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-3xl font-bold">{stats[key].toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="rounded border border-border bg-panel/30 p-6">
        <h2 className="text-lg font-semibold mb-2">Active Instances</h2>
        <p className="text-3xl font-bold text-green-400">{stats.activeInstances}</p>
        <p className="text-sm text-text-secondary mt-1">
          {stats.totalInstances > 0
            ? `${Math.round((stats.activeInstances / stats.totalInstances) * 100)}% of all instances`
            : 'No instances deployed yet'}
        </p>
      </div>

      <div className="rounded border border-border bg-panel/30 p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Trust Funnel</h2>
            <p className="mt-1 text-sm text-text-secondary">Public trust-page traffic, trial intent, signup views, and sales requests.</p>
          </div>
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            {stats.trustFunnel.recentViews7d} views in the last 7 days
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TrustCard
            label="Trust Page Views"
            value={stats.trustFunnel.trustPageViews}
            helper={`${stats.trustFunnel.recentViews7d} in the last 7 days`}
            icon={TrendingUp}
            color="text-cyan-300"
          />
          <TrustCard
            label="Trial Starts"
            value={stats.trustFunnel.trustTrialStarts}
            helper={`${trustToTrialRate}% of trust-page views`}
            icon={ArrowUpRight}
            color="text-info"
          />
          <TrustCard
            label="Signup Views"
            value={stats.trustFunnel.trustSignupViews}
            helper={`${trustToSignupRate}% of trust-page views`}
            icon={UserPlus}
            color="text-violet-300"
          />
          <TrustCard
            label="Qualified Leads"
            value={stats.trustFunnel.totalLeads}
            helper={`${stats.trustFunnel.trustDemoRequests} demo/contact submissions`}
            icon={BriefcaseBusiness}
            color="text-amber-300"
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded border border-border bg-void/40 p-5">
            <p className="text-sm text-text-secondary">Recent lead flow</p>
            <p className="mt-3 text-3xl font-bold text-white">{stats.trustFunnel.recentLeads7d}</p>
            <p className="mt-2 text-sm text-text-dim">Enterprise leads captured in the last 7 days.</p>
          </div>

          <div className="rounded border border-border bg-void/40 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">Top trust sources</p>
              <span className="text-xs text-text-dim">Lifetime event volume</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {stats.trustFunnel.topSources.length > 0 ? stats.trustFunnel.topSources.map((source) => (
                <div key={source.source} className="rounded-full border border-wire bg-panel px-3 py-1.5 text-sm text-neutral-200">
                  {source.source} <span className="text-text-dim">{source.count}</span>
                </div>
              )) : (
                <p className="text-sm text-text-dim">No trust-source data captured yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustCard({
  label,
  value,
  helper,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof TrendingUp;
  color: string;
}) {
  return (
    <div className="rounded border border-border bg-void/40 p-5">
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">{label}</p>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="mt-2 text-sm text-text-dim">{helper}</p>
    </div>
  );
}
