'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Filter } from 'lucide-react';
import { FindingsSkeleton } from '@/components/dashboard/FindingsSkeleton';
import { UnifiedFindingsSummary } from '@/components/dashboard/UnifiedFindingsSummary';
import {
  UnifiedFindingRow,
  type UnifiedFinding,
} from '@/components/dashboard/UnifiedFindingRow';

interface UnifiedSummary {
  bySeverity: { critical: number; high: number; medium: number; low: number; info: number };
  bySource: { cspm: number; pipewarden: number; tenantiq: number; sdlc: number };
  total: number;
}

export default function UnifiedFindingsPage() {
  const [findings, setFindings] = useState<UnifiedFinding[]>([]);
  const [summary, setSummary] = useState<UnifiedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');

  const loadFindings = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (source) params.set('source', source);
    params.set('limit', '100');
    const qs = params.toString() ? `?${params.toString()}` : '';

    Promise.all([
      fetch(`/api/proxy/findings/unified${qs}`).then((r) => r.json()),
      fetch(`/api/proxy/findings/unified/summary`).then((r) => r.json()),
    ])
      .then(([list, sum]) => {
        setFindings((list?.data ?? []) as UnifiedFinding[]);
        setSummary((sum?.data ?? null) as UnifiedSummary | null);
      })
      .catch((e) => {
        console.error('Failed to load unified findings', e);
      })
      .finally(() => setLoading(false));
  }, [severity, source]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: loadFindings is a useCallback that fetches and updates state
    loadFindings();
  }, [loadFindings]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-signal" />
            Unified Findings
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Cross-portfolio security findings: cloud posture (CSPM), CI/CD (PipeWarden),
            M365 (TenantIQ), DLP (SDLC.cc).
          </p>
        </div>
      </header>

      {summary && <UnifiedFindingsSummary summary={summary} />}

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-zinc-500" />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100"
        >
          <option value="">All sources</option>
          <option value="cspm">CSPM</option>
          <option value="pipewarden">PipeWarden</option>
          <option value="tenantiq">TenantIQ</option>
          <option value="sdlc">SDLC.cc</option>
        </select>
      </div>

      {loading ? (
        <FindingsSkeleton />
      ) : findings.length === 0 ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
          No findings match your filters.
        </div>
      ) : (
        <ul className="space-y-2">
          {findings.map((f) => (
            <UnifiedFindingRow key={`${f.source}-${f.id}`} finding={f} />
          ))}
        </ul>
      )}
    </div>
  );
}
