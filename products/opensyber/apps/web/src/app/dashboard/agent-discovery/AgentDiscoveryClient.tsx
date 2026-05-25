'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DiscoveredAgentRow } from './types';

export function AgentDiscoveryClient(): React.ReactElement {
  const [agents, setAgents] = useState<DiscoveredAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingRun, setStartingRun] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsecured' | 'protected' | 'ignored'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({});

  async function loadAgents(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch('/api/proxy/discovery/agents');
      const body = await response.json() as { data?: DiscoveredAgentRow[] };
      setAgents(Array.isArray(body.data) ? body.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  async function startRun(): Promise<void> {
    setStartingRun(true);
    try {
      await fetch('/api/proxy/discovery/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'manual' }),
      });
      await loadAgents();
    } finally {
      setStartingRun(false);
    }
  }

  async function protectAgent(agentId: string): Promise<void> {
    await fetch(`/api/proxy/discovery/agents/${agentId}/protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setAgents((current) => current.map((agent) => (
      agent.id === agentId ? { ...agent, status: 'protected', protected: true } : agent
    )));
  }

  async function saveOwner(agentId: string): Promise<void> {
    const ownerUserId = ownerDrafts[agentId]?.trim();
    await fetch(`/api/proxy/discovery/agents/${agentId}/owner`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerUserId: ownerUserId || null }),
    });
    setAgents((current) => current.map((agent) => (
      agent.id === agentId ? { ...agent, ownerUserId: ownerUserId || null } : agent
    )));
  }

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (search && !agent.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
      if (severityFilter !== 'all' && agent.riskSeverity !== severityFilter) return false;
      return true;
    });
  }, [agents, search, statusFilter, severityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agent Discovery</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Discover unknown AI agents, map ownership, and protect risky workloads.
          </p>
        </div>
        <button
          type="button"
          onClick={startRun}
          disabled={startingRun}
          className="rounded-lg border border-wire bg-surface px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
        >
          {startingRun ? 'Starting Run...' : 'Start Discovery Run'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search agents"
          className="rounded-lg border border-wire bg-surface px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="rounded-lg border border-wire bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All status</option>
          <option value="unsecured">Unsecured</option>
          <option value="protected">Protected</option>
          <option value="ignored">Ignored</option>
        </select>
        <select
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}
          className="rounded-lg border border-wire bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-wire bg-surface p-6 text-sm text-text-secondary">
          Loading discovered agents...
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="rounded-lg border border-wire bg-surface p-6 text-sm text-text-secondary">
          No discovered agents yet. Start a discovery run to populate this table.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-wire">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="min-w-full divide-y divide-wire text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Agent</th>
                <th className="px-3 py-2 text-left">Surface</th>
                <th className="px-3 py-2 text-left">Risk</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wire bg-void">
              {filteredAgents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-text-dim">{agent.framework} • {agent.runtime}</div>
                  </td>
                  <td className="px-3 py-2">{agent.surfaceType}</td>
                  <td className="px-3 py-2">{agent.riskSeverity} ({agent.riskScore})</td>
                  <td className="px-3 py-2">{agent.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <input
                        value={ownerDrafts[agent.id] ?? agent.ownerUserId ?? ''}
                        onChange={(event) => setOwnerDrafts((current) => ({ ...current, [agent.id]: event.target.value }))}
                        placeholder="owner id"
                        className="w-full rounded border border-wire bg-surface px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void saveOwner(agent.id)}
                        className="rounded border border-wire px-2 py-1 text-xs hover:bg-neutral-700"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void protectAgent(agent.id)}
                        disabled={agent.status === 'protected'}
                        className="rounded border border-green-500/40 px-2 py-1 text-xs text-green-300 disabled:opacity-50"
                      >
                        Protect
                      </button>
                      <Link href={`/dashboard/agent-discovery/${agent.id}`} className="text-xs text-signal underline">
                        Details
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
