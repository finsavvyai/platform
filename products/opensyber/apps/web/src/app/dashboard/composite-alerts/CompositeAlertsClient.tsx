'use client';

import { useState, useMemo } from 'react';
import { Layers, AlertTriangle, Link2, TrendingDown } from 'lucide-react';
import type { CompositeAlert } from './types';
import { AlertCard } from './AlertCard';

type ConfidenceFilter = 'all' | 'high' | 'medium';

export function CompositeAlertsClient(): React.ReactElement {
  const [alerts, setAlerts] = useState<CompositeAlert[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');

  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status === 'Active').length;
    const totalEvents = alerts.reduce((s, a) => s + a.events.length, 0);
    return { active, totalEvents };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (confidenceFilter === 'high') return a.confidence >= 85;
      if (confidenceFilter === 'medium') return a.confidence >= 70 && a.confidence < 85;
      return true;
    });
  }, [alerts, confidenceFilter]);

  function handleAction(id: string, action: 'acknowledge' | 'dismiss'): void {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (action === 'acknowledge') return { ...a, status: 'Acknowledged' as const };
        return { ...a, status: 'Dismissed' as const };
      }),
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Layers className="h-8 w-8 text-info" />
          Composite Alerts
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Automatically correlates multiple low-severity events into
          high-confidence attack narratives, reducing alert fatigue.
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <AlertTriangle className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Composite Alerts Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing correlated security alerts. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={AlertTriangle} label="Active Composite Alerts" value={stats.active} color="text-red-400" />
            <StatCard icon={Link2} label="Events Correlated" value={stats.totalEvents} color="text-info" />
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-green-400" />
                <span className="text-sm text-neutral-400">Noise Reduction</span>
              </div>
              <p className="mt-2 text-lg font-bold">
                <span className="text-green-400">{alerts.length} alerts</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Confidence:</span>
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
              >
                <option value="all">All Levels</option>
                <option value="high">High (85%+)</option>
                <option value="medium">Medium (70-84%)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filtered.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                onAction={(action) => handleAction(a.id, action)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <Layers className="h-8 w-8 text-neutral-600 mb-3" />
                <p className="text-neutral-400 text-sm">No alerts match current filters.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof AlertTriangle; label: string; value: number; color: string;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
