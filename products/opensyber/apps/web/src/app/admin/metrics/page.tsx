import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { TrendingUp, Users, Server, Package, DollarSign, BarChart3 } from 'lucide-react';
import { AdminChartsPanel } from '@/components/admin/AdminChartsPanel';

export const metadata = { title: 'Series A Data Room' };

interface DataroomMetrics {
  snapshot: string;
  revenue: { mrr: number; arr: number; payingCustomers: number; arpu: number };
  usage: { totalUsers: number; totalOrgs: number; totalInstances: number; totalSkills: number; totalSkillInstalls: number; avgInstancesPerOrg: number };
  planBreakdown: Record<string, number>;
  conversion: { freeToPayingRate: number };
}

export default async function MetricsPage() {
  let metrics: DataroomMetrics | null = null;
  try {
    const token = await getApiToken();
    if (token) {
      const res = await apiClient<{ data: DataroomMetrics }>('/api/metrics/dataroom', { token });
      metrics = res.data;
    }
  } catch (err) { console.error('[AdminMetrics] Failed to fetch dataroom metrics:', err instanceof Error ? err.message : err); }

  if (!metrics) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Series A Data Room</h1>
        <p className="text-text-secondary mt-2">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-cyan-500" /> Series A Data Room
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Snapshot: {new Date(metrics.snapshot).toLocaleDateString()}
        </p>
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign} label="MRR" value={`$${metrics.revenue.mrr.toLocaleString()}`} color="text-green-400" />
        <MetricCard icon={TrendingUp} label="ARR" value={`$${metrics.revenue.arr.toLocaleString()}`} color="text-green-400" />
        <MetricCard icon={Users} label="Paying Customers" value={String(metrics.revenue.payingCustomers)} color="text-signal" />
        <MetricCard icon={DollarSign} label="ARPU" value={`$${metrics.revenue.arpu}`} color="text-cyan-400" />
      </div>

      {/* Usage */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={Users} label="Total Users" value={String(metrics.usage.totalUsers)} color="text-text-primary" />
        <MetricCard icon={Server} label="Agent Instances" value={String(metrics.usage.totalInstances)} color="text-text-primary" />
        <MetricCard icon={Package} label="Skill Installs" value={String(metrics.usage.totalSkillInstalls)} color="text-text-primary" />
      </div>

      {/* Plan Breakdown */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h2 className="text-lg font-semibold mb-4">Plan Distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(metrics.planBreakdown).map(([plan, count]) => (
            <div key={plan} className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-text-dim capitalize">{plan}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h2 className="text-lg font-semibold mb-2">Conversion</h2>
        <p className="text-3xl font-bold text-signal">
          {metrics.conversion.freeToPayingRate}%
        </p>
        <p className="text-xs text-text-dim mt-1">Free → Paying conversion rate</p>
      </div>

      {/* Charts */}
      <AdminChartsPanel planBreakdown={metrics.planBreakdown} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded border border-border bg-panel/30 p-4">
      <div className="flex items-center gap-2 text-xs text-text-dim mb-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
