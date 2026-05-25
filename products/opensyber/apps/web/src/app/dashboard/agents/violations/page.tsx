'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldOff, Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ViolationsSkeleton } from '@/components/dashboard/ViolationsSkeleton';

interface Violation {
  id: string;
  policyId: string;
  policyName: string;
  userId: string;
  userName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  acknowledged: boolean;
  createdAt: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-signal/10 text-signal',
};

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [ackFilter, setAckFilter] = useState('');

  const loadViolations = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (ackFilter) params.set('acknowledged', ackFilter);
    const qs = params.toString() ? `?${params.toString()}` : '';

    fetch(`/api/proxy/agents/policies${qs}`)
      .then((r) => r.json())
      .then((d) => setViolations(d.violations ?? []))
      .catch(() => setViolations([]))
      .finally(() => setLoading(false));
  }, [severity, ackFilter]);

  useEffect(() => { queueMicrotask(() => loadViolations()); }, [loadViolations]);

  async function acknowledge(id: string) {
    await fetch(`/api/proxy/agents/policies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged: true }),
    });
    loadViolations();
  }

  if (loading) {
    return <ViolationsSkeleton />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Policy Violations</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Agent actions that triggered security policies
        </p>
      </div>

      <div className="mb-4 flex gap-3">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-md border border-border bg-void px-3 py-1.5 text-sm"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={ackFilter}
          onChange={(e) => setAckFilter(e.target.value)}
          className="rounded-md border border-border bg-void px-3 py-1.5 text-sm"
        >
          <option value="">All Status</option>
          <option value="false">Unacknowledged</option>
          <option value="true">Acknowledged</option>
        </select>
      </div>

      {violations.length === 0 ? (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <ShieldOff className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">No violations</p>
          <p className="mt-2 text-sm text-text-dim">
            No agent policy violations have been detected.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-panel/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Severity</th>
                <th className="px-6 py-3 font-medium">Policy</th>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Summary</th>
                <th className="px-6 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {violations.map((v) => (
                <tr key={v.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                    {formatDate(v.createdAt)}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEV_COLORS[v.severity]}`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium">{v.policyName}</td>
                  <td className="px-6 py-3 text-text-secondary">{v.userName}</td>
                  <td className="px-6 py-3 text-text-secondary max-w-xs truncate">{v.summary}</td>
                  <td className="px-6 py-3 text-right">
                    {v.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-text-dim">
                        <Check className="h-3 w-3" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => acknowledge(v.id)}
                        className="rounded-lg border border-wire px-3 py-1 text-xs hover:bg-surface transition"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
