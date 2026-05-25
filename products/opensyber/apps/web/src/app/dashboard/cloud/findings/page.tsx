'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { FindingsSkeleton } from '@/components/dashboard/FindingsSkeleton';

interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  resourceType: string;
  region: string;
  status: 'open' | 'muted' | 'resolved';
  firstSeenAt: string;
}

interface FindingSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-signal/10 text-signal',
};

const SUMMARY_CARDS: { key: keyof FindingSummary; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: 'border-red-500/30 text-red-400' },
  { key: 'high', label: 'High', color: 'border-amber-500/30 text-amber-400' },
  { key: 'medium', label: 'Medium', color: 'border-yellow-500/30 text-yellow-400' },
  { key: 'low', label: 'Low', color: 'border-info/30 text-signal' },
];

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<FindingSummary>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');

  const loadFindings = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (status) params.set('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';

    fetch(`/api/proxy/cloud/findings${qs}`)
      .then((r) => r.json())
      .then((d) => {
        const list: Finding[] = d.data ?? [];
        setFindings(list);
        const computed: FindingSummary = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const f of list) {
          if (f.severity in computed) {
            computed[f.severity] += 1;
          }
        }
        setSummary(computed);
      })
      .catch(() => setFindings([]))
      .finally(() => setLoading(false));
  }, [severity, status]);

  useEffect(() => { queueMicrotask(() => loadFindings()); }, [loadFindings]);

  async function updateFinding(id: string, newStatus: 'muted' | 'resolved') {
    await fetch(`/api/proxy/cloud/findings/${id}/${newStatus === 'muted' ? 'mute' : 'resolve'}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    loadFindings();
  }

  if (loading) {
    return <FindingsSkeleton />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">CSPM Findings</h1>
        <p className="mt-1 text-sm text-text-secondary">Cloud security posture misconfigurations</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {SUMMARY_CARDS.map(({ key, label, color }) => (
          <div key={key} className={`rounded border bg-panel/30 p-4 ${color}`}>
            <p className="text-3xl font-bold">{summary[key]}</p>
            <p className="mt-1 text-xs opacity-70">{label}</p>
          </div>
        ))}
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-void px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="muted">Muted</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {findings.length === 0 ? (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">No findings</p>
          <p className="mt-2 text-sm text-text-dim">
            Connect a cloud account and run a scan to detect misconfigurations.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-panel/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Severity</th>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Resource</th>
                <th className="px-6 py-3 font-medium">Region</th>
                <th className="px-6 py-3 font-medium">First Seen</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {findings.map((f) => (
                <tr key={f.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEV_COLORS[f.severity]}`}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium max-w-xs truncate">{f.title}</td>
                  <td className="px-6 py-3 text-text-secondary font-mono text-xs">{f.resourceType}</td>
                  <td className="px-6 py-3 text-text-secondary">{f.region}</td>
                  <td className="px-6 py-3 text-text-dim">{formatDate(f.firstSeenAt)}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {f.status === 'open' && (
                        <>
                          <button
                            onClick={() => updateFinding(f.id, 'muted')}
                            className="rounded-lg border border-wire px-2 py-1 text-xs hover:bg-surface transition"
                          >
                            Mute
                          </button>
                          <button
                            onClick={() => updateFinding(f.id, 'resolved')}
                            className="rounded-lg border border-green-500/30 px-2 py-1 text-xs text-green-400 hover:bg-green-500/10 transition"
                          >
                            Resolve
                          </button>
                        </>
                      )}
                      {f.status !== 'open' && (
                        <span className="text-xs text-text-dim capitalize">{f.status}</span>
                      )}
                    </div>
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
