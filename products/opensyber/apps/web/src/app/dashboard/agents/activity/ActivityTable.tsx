'use client';

import { useState, useMemo } from 'react';
import { Shield, ExternalLink } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { type ActivityEvent, type RiskLevel, riskBadgeBg } from './types';

interface ActivityTableProps {
  events: ActivityEvent[];
}

const RISK_OPTIONS: Array<{ label: string; value: RiskLevel | 'all' }> = [
  { label: 'All Risks', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

export function ActivityTable({ events }: ActivityTableProps) {
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const agents = useMemo(() => {
    const set = new Set(events.map((e) => e.agentName));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (riskFilter !== 'all' && e.riskLevel !== riskFilter) return false;
      if (agentFilter !== 'all' && e.agentName !== agentFilter) return false;
      return true;
    });
  }, [events, riskFilter, agentFilter]);

  if (events.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <FilterBar
        riskFilter={riskFilter}
        agentFilter={agentFilter}
        agents={agents}
        onRiskChange={setRiskFilter}
        onAgentChange={setAgentFilter}
      />
      <EventTable events={filtered} />
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
                     font-medium text-neutral-300 hover:bg-neutral-800 transition
                     flex items-center gap-1"
        >
          View Docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

interface FilterBarProps {
  riskFilter: RiskLevel | 'all';
  agentFilter: string;
  agents: string[];
  onRiskChange: (v: RiskLevel | 'all') => void;
  onAgentChange: (v: string) => void;
}

function FilterBar({ riskFilter, agentFilter, agents, onRiskChange, onAgentChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={riskFilter}
        onChange={(e) => onRiskChange(e.target.value as RiskLevel | 'all')}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5
                   text-sm text-neutral-300 focus:outline-none focus:ring-1
                   focus:ring-signal"
        aria-label="Filter by risk level"
      >
        {RISK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <select
        value={agentFilter}
        onChange={(e) => onAgentChange(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5
                   text-sm text-neutral-300 focus:outline-none focus:ring-1
                   focus:ring-signal"
        aria-label="Filter by agent"
      >
        <option value="all">All Agents</option>
        {agents.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  );
}

function EventTable({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-400">
            <th className="px-6 py-3 font-medium">Time</th>
            <th className="px-6 py-3 font-medium">Agent</th>
            <th className="px-6 py-3 font-medium">Event</th>
            <th className="px-6 py-3 font-medium">Risk</th>
            <th className="px-6 py-3 font-medium">Path</th>
            <th className="px-6 py-3 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {events.map((ev) => (
            <tr key={ev.id} className="hover:bg-neutral-800/30 transition">
              <td className="whitespace-nowrap px-6 py-3 text-neutral-500">
                {formatRelativeTime(ev.timestamp)}
              </td>
              <td className="px-6 py-3 font-medium">{ev.agentName}</td>
              <td className="px-6 py-3 text-neutral-400">{ev.eventType}</td>
              <td className="px-6 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeBg(ev.riskLevel)}`}>
                  {ev.riskLevel}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-6 py-3 text-neutral-500 font-mono text-xs">
                {ev.path}
              </td>
              <td className="max-w-[300px] truncate px-6 py-3 text-neutral-400">
                {ev.summary}
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                No events match the selected filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
