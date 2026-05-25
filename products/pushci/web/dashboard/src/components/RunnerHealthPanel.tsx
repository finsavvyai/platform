import { useEffect, useState, useCallback } from 'react';
import { api, type CloudPoolStatus, type CloudRunner } from '../hooks/useApi';
import { friendlyError } from '../utils/errorMessages';

interface HealthMetrics {
  pool: CloudPoolStatus;
  runners: CloudRunner[];
  jobsLast24h: number;
  avgUptimeMinutes: number;
}

function StatusBar({ idle, busy, offline }: { idle: number; busy: number; offline: number }) {
  const total = idle + busy + offline;
  if (total === 0) {
    return (
      <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full bg-zinc-700 w-full" />
      </div>
    );
  }
  const pctIdle = (idle / total) * 100;
  const pctBusy = (busy / total) * 100;
  const pctOffline = (offline / total) * 100;

  return (
    <div className="h-3 rounded-full bg-zinc-800 overflow-hidden flex">
      {pctIdle > 0 && (
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${pctIdle}%` }}
          title={`Idle: ${idle}`}
        />
      )}
      {pctBusy > 0 && (
        <div
          className="h-full bg-amber-500"
          style={{ width: `${pctBusy}%` }}
          title={`Busy: ${busy}`}
        />
      )}
      {pctOffline > 0 && (
        <div
          className="h-full bg-red-500"
          style={{ width: `${pctOffline}%` }}
          title={`Offline: ${offline}`}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-zinc-900/50 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      {text}
    </span>
  );
}

function computeMetrics(pool: CloudPoolStatus, runners: CloudRunner[]): HealthMetrics {
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const activeRecently = runners.filter(
    (r) => new Date(r.last_heartbeat).getTime() > twentyFourHoursAgo,
  );

  const onlineRunners = runners.filter((r) => r.status !== 'offline');
  let avgUptimeMinutes = 0;
  if (onlineRunners.length > 0) {
    const totalMs = onlineRunners.reduce((sum, r) => {
      const heartbeatAge = now - new Date(r.last_heartbeat).getTime();
      const uptime = now - new Date(r.created_at).getTime();
      return sum + Math.max(0, uptime - heartbeatAge);
    }, 0);
    avgUptimeMinutes = Math.round(totalMs / onlineRunners.length / 60000);
  }

  return {
    pool,
    runners,
    jobsLast24h: activeRecently.length,
    avgUptimeMinutes,
  };
}

function formatUptime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return `${hours}h ${remaining}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export default function RunnerHealthPanel() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await api.getRunnerPool();
      const pool = data.pool ?? { total: 0, idle: 0, busy: 0, pending: 0 };
      const runners = data.runners ?? [];
      setMetrics(computeMetrics(pool, runners));
      setError(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
    const interval = setInterval(() => void loadMetrics(), 30000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  const pool = metrics?.pool;
  const offlineCount = pool
    ? Math.max(0, pool.total - pool.idle - pool.busy - pool.pending)
    : 0;

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Fleet Health</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Auto-refreshes every 30 seconds
          </p>
        </div>
        {!loading && !error && (
          <span className="text-[11px] text-zinc-600">
            Updated {new Date().toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading health metrics...</div>
      ) : metrics ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">Status Breakdown</span>
              <span className="text-xs font-medium text-zinc-300">
                {pool?.total ?? 0} runner{(pool?.total ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <StatusBar
              idle={pool?.idle ?? 0}
              busy={pool?.busy ?? 0}
              offline={offlineCount}
            />
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-zinc-400">Idle ({pool?.idle ?? 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[11px] text-zinc-400">Busy ({pool?.busy ?? 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[11px] text-zinc-400">Offline ({offlineCount})</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Runners" value={String(pool?.total ?? 0)} />
            <MetricCard label="Avg Uptime" value={metrics.avgUptimeMinutes > 0 ? formatUptime(metrics.avgUptimeMinutes) : '--'} sub="Online runners" />
            <MetricCard label="Active (24h)" value={String(metrics.jobsLast24h)} sub="Runners with recent heartbeats" />
            <MetricCard label="Pending" value={String(pool?.pending ?? 0)} sub="Awaiting assignment" />
          </div>

          <div>
            <div className="text-xs text-zinc-500 mb-2">Resource Monitoring</div>
            <div className="flex flex-wrap gap-2">
              <Badge text="CPU usage - Coming soon" />
              <Badge text="Memory usage - Coming soon" />
              <Badge text="Disk I/O - Coming soon" />
              <Badge text="Network - Coming soon" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
