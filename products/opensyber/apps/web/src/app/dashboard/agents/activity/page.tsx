'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { type ActivitySummary, type ActivityEvent } from './types';
import { SummaryCards } from './SummaryCards';
import { ActivityTable } from './ActivityTable';

export default function AgentActivityPage() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/agent-monitor').then((r) => r.json()),
      fetch('/api/proxy/agent-monitor/events').then((r) => r.json()),
    ])
      .then(([summaryData, eventsData]) => {
        if (summaryData && typeof summaryData.totalEvents === 'number') {
          const riskBreakdown = summaryData.riskBreakdown ?? {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          };
          const agents: unknown = summaryData.agents;
          const agentsMonitored = Array.isArray(agents)
            ? agents.length
            : typeof agents === 'number'
              ? agents
              : 0;
          setSummary({
            totalEvents: summaryData.totalEvents ?? 0,
            criticalEvents: riskBreakdown.critical ?? 0,
            agentsMonitored,
            riskScore: summaryData.riskScore ?? 0,
            riskBreakdown,
          });
        } else {
          setSummary(null);
        }
        setEvents(eventsData.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!summary) {
    return (
      <div>
        <h1 className="text-4xl font-bold mb-2">Agent Activity</h1>
        <p className="text-sm text-neutral-400 mb-8">
          Monitor what your AI agents are doing across your team
        </p>
        <EmptyState />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Agent Activity</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Monitor what your AI agents are doing across your team
        </p>
      </div>

      <div className="mb-8">
        <SummaryCards summary={summary} />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        <ActivityTable events={events} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center">
      <Shield className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
      <p className="text-lg font-medium text-neutral-300">
        No agent activity detected
      </p>
      <p className="mt-2 text-sm text-neutral-500 max-w-md mx-auto">
        Install OpenAgent to monitor your AI agents in real time
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <a
          href="/openagent"
          className="rounded-lg bg-info px-4 py-2 text-sm font-medium
                     text-white hover:bg-info transition"
        >
          Install Extension
        </a>
        <a
          href="/docs"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm
                     font-medium text-neutral-300 hover:bg-neutral-800 transition"
        >
          View Docs
        </a>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-10 w-48 rounded bg-neutral-800 animate-pulse mb-2" />
        <div className="h-4 w-80 rounded bg-neutral-800 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="h-3 w-20 rounded bg-neutral-800 animate-pulse mb-3" />
            <div className="h-8 w-16 rounded bg-neutral-800 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-neutral-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
