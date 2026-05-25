'use client';

import { useEffect, useState } from 'react';
import { Shield, Download, Trash2 } from 'lucide-react';
import { AgentsSkeleton } from '@/components/dashboard/AgentsSkeleton';
import { RiskTrendChart } from '@/components/dashboard/RiskTrendChart';
import { CloudFindings } from './CloudFindings';
import type { Summary } from './agents-helpers';
import { computeScore } from './agents-helpers';
import { ScoreCard, StatGrid, RiskDistribution } from './AgentsCards';

export default function AgentsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/proxy/agents')
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  async function clearActivity() {
    if (!confirm('Clear all agent activity? This cannot be undone.')) return;
    setClearing(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/agents', { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      setSummary({ total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setClearing(false);
    }
  }

  const score = summary ? computeScore(summary) : null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Activity</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cloud-synced audit log from the OpenAgent VS Code extension
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="https://marketplace.visualstudio.com/items?itemName=opensyber.opensyber-openagent"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 rounded-lg border border-wire bg-surface px-4 py-2.5 text-sm font-medium min-h-[44px] hover:bg-neutral-700 transition-colors duration-200"
          >
            <Download className="h-4 w-4" aria-hidden="true" />Install Extension
          </a>
          {summary && summary.total > 0 && (
            <button
              onClick={clearActivity}
              disabled={clearing}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 min-h-[44px] hover:bg-red-500/20 transition-colors duration-200 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-2 mb-4">{error}</p>}

      {loading && <AgentsSkeleton />}

      {!loading && !summary && (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-text-dim" aria-hidden="true" />
          <p className="text-lg font-medium text-text-secondary">No agent activity synced yet</p>
          <p className="mt-2 text-sm text-text-dim">
            Install the OpenAgent VS Code extension and enable cloud sync in settings.
          </p>
        </div>
      )}

      {!loading && summary && (
        <>
          <ScoreCard score={score!} summary={summary} />
          <StatGrid summary={summary} />
          <RiskTrendChart endpoint="/api/proxy/agents/risk-trend" days={30} />
          {summary.total > 0 && <RiskDistribution summary={summary} />}
          <CloudFindings />
          {summary.total === 0 && (
            <div className="mt-6 rounded border border-info/20 bg-info/5 p-6">
              <p className="font-semibold text-signal">Extension not yet syncing</p>
              <p className="mt-1 text-sm text-text-secondary">
                Open VS Code, OpenAgent settings, enable <strong>Cloud Sync</strong> and paste your API key.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

