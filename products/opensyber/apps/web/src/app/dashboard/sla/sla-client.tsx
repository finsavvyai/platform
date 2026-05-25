'use client';

import { useEffect, useState } from 'react';
import { Timer, CheckCircle, XCircle, Activity } from 'lucide-react';

interface SlaStatus {
  targetUptime: number;
  currentUptime: number;
  isCompliant: boolean;
  totalChecks: number;
  period: string;
  responseTime: { avg: number; min: number; max: number };
}

interface DailyUptime {
  day: string;
  uptime: number;
  avgResponseMs: number;
}

interface SlaMetrics {
  period: string;
  dailyUptime: DailyUptime[];
  mttrMinutes: number;
}

export function SlaClient() {
  const [status, setStatus] = useState<SlaStatus | null>(null);
  const [metrics, setMetrics] = useState<SlaMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/sla').then((r) => r.json()),
      fetch('/api/proxy/sla/metrics?days=30').then((r) => r.json()),
    ])
      .then(([s, m]) => { setStatus(s.data); setMetrics(m.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface rounded w-1/3" />
          <div className="h-48 bg-surface rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">SLA Monitor</h1>
          <p className="text-sm text-text-secondary mt-1">Track uptime and response time SLAs for your agent infrastructure</p>
        </div>
        <button
          className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition min-h-[44px]"
          onClick={() => window.open('/dashboard/settings', '_self')}
        >
          Configure SLA
        </button>
      </div>

      {!status ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
          <Timer className="w-12 h-12 mb-4" />
          <p className="text-lg">No uptime data available</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <Card label="Current Uptime" value={`${status.currentUptime}%`}
              icon={status.isCompliant ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />} />
            <Card label="Target" value={`${status.targetUptime}%`} icon={<Activity className="w-5 h-5 text-signal" />} />
            <Card label="Avg Response" value={`${status.responseTime.avg}ms`} icon={<Timer className="w-5 h-5 text-amber-500" />} />
            <Card label="MTTR" value={metrics ? `${metrics.mttrMinutes}min` : 'N/A'} icon={<Timer className="w-5 h-5 text-text-secondary" />} />
          </div>

          {metrics && metrics.dailyUptime.length > 0 && (
            <div className="bg-panel/30 border border-border rounded p-8">
              <h2 className="text-lg font-medium mb-4">Daily Uptime (Last 30 Days)</h2>
              <div className="flex gap-1 items-end h-32">
                {metrics.dailyUptime.slice(0, 30).reverse().map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-sm ${d.uptime >= 99.9 ? 'bg-green-500' : d.uptime >= 99 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ height: `${Math.max(d.uptime - 95, 1) * 20}px` }}
                      title={`${d.day}: ${d.uptime}%`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-2 text-center">
                Green = 99.9%+ | Amber = 99%+ | Red = &lt;99%
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-panel/30 border border-border rounded p-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-secondary">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
