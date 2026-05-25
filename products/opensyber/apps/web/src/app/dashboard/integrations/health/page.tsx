import Link from 'next/link';
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import type { IntegrationHealthResponse, IntegrationHealth, HealthSummary } from './health-types';

export const metadata = { title: 'Integration Health — OpenSyber' };

export default async function IntegrationHealthPage() {
  let data: IntegrationHealthResponse | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      data = await apiClient<IntegrationHealthResponse>('/api/integrations/health', { token });
    }
  } catch (err) { console.error('[IntegrationHealth] Failed to fetch health data:', err instanceof Error ? err.message : err); }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6 text-signal" />
          Integration Health
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Monitor the health and performance of your connected integrations
        </p>
      </div>
      {data ? (
        <>
          <SummaryCards summary={data.summary} />
          <HealthTable integrations={data.integrations} />
        </>
      ) : (
        <p className="text-sm text-text-dim">Unable to load integration health data.</p>
      )}
    </div>
  );
}

function SummaryCards({ summary }: { summary: HealthSummary }) {
  const cards = [
    { label: 'Healthy', count: summary.healthy, icon: CheckCircle2, color: 'text-green-400', bg: 'border-green-500/20' },
    { label: 'Degraded', count: summary.degraded, icon: AlertTriangle, color: 'text-yellow-400', bg: 'border-yellow-500/20' },
    { label: 'Down', count: summary.down, icon: XCircle, color: 'text-red-400', bg: 'border-red-500/20' },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(({ label, count, icon: Icon, color, bg }) => (
        <div key={label} className={`rounded border ${bg} bg-panel/30 p-5 text-center`}>
          <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-xs text-text-dim mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

function HealthTable({ integrations }: { integrations: IntegrationHealth[] }) {
  if (integrations.length === 0) {
    return (
      <div className="rounded border border-border bg-panel/30 p-8 text-center">
        <p className="text-sm text-text-dim">No integrations connected yet.</p>
        <Link href="/dashboard/integrations" className="text-sm text-signal hover:text-signal-hover mt-2 inline-block">
          Browse integrations
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-panel/30 overflow-hidden">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-secondary text-xs">
            <th className="text-left p-4 font-medium">Integration</th>
            <th className="text-left p-4 font-medium">Status</th>
            <th className="text-left p-4 font-medium">Health</th>
            <th className="text-right p-4 font-medium">Events</th>
            <th className="text-right p-4 font-medium">Errors</th>
            <th className="text-right p-4 font-medium">Avg Latency</th>
            <th className="text-left p-4 font-medium">Last Sync</th>
          </tr>
        </thead>
        <tbody>
          {integrations.map((item) => (
            <IntegrationRow key={item.id} item={item} />
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function IntegrationRow({ item }: { item: IntegrationHealth }) {
  return (
    <tr className="border-b border-border/50 hover:bg-surface/20 transition">
      <td className="p-4 font-medium capitalize">
        <Link href={`/dashboard/integrations/${item.slug}`} className="hover:text-signal transition">
          {item.slug}
        </Link>
      </td>
      <td className="p-4">
        <StatusBadge status={item.status} />
      </td>
      <td className="p-4">
        <HealthBadge health={item.health} />
      </td>
      <td className="p-4 text-right tabular-nums">{item.eventsReceived.toLocaleString()}</td>
      <td className="p-4 text-right tabular-nums">{item.errorCount}</td>
      <td className="p-4 text-right tabular-nums">{item.avgLatencyMs}ms</td>
      <td className="p-4 text-text-secondary">{formatRelative(item.lastSyncAt)}</td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: 'bg-green-500/10 text-green-400 border-green-500/20',
    disconnected: 'bg-neutral-500/10 text-text-secondary border-neutral-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function HealthBadge({ health }: { health: string }) {
  const styles: Record<string, string> = {
    healthy: 'bg-green-500/10 text-green-400 border-green-500/20',
    degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    down: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[health] ?? styles.degraded}`}>
      {health}
    </span>
  );
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}
