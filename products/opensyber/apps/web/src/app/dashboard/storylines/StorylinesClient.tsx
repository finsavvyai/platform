'use client';

import { useState, useMemo } from 'react';
import { BookOpen, AlertTriangle, Activity } from 'lucide-react';
import type { Storyline, StorylineStatus, EventSeverity } from './types';
import { StorylineCard } from './StorylineCard';

const STATUS_FILTERS: StorylineStatus[] = ['Active', 'Contained', 'Resolved'];
const SEVERITY_FILTERS: EventSeverity[] = ['Critical', 'High', 'Medium', 'Low'];

export function StorylinesClient(): React.ReactElement {
  const [storylines, setStorylines] = useState<Storyline[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const stats = useMemo(() => {
    const active = storylines.filter((s) => s.status === 'Active').length;
    const critical = storylines.filter((s) => s.severity === 'Critical').length;
    const avgEvents = storylines.length > 0
      ? Math.round(storylines.reduce((sum, s) => sum + s.eventCount, 0) / storylines.length)
      : 0;
    return { active, critical, avgEvents };
  }, [storylines]);

  const filtered = useMemo(() => {
    return storylines.filter(
      (s) =>
        (statusFilter === 'all' || s.status === statusFilter) &&
        (severityFilter === 'all' || s.severity === severityFilter),
    );
  }, [storylines, statusFilter, severityFilter]);

  function handleAction(id: string, action: string): void {
    setStorylines((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (action === 'contain') return { ...s, status: 'Contained' as const };
        if (action === 'remediate') return { ...s, status: 'Resolved' as const };
        if (action === 'benign') return { ...s, verdict: 'Benign' as const, status: 'Resolved' as const };
        return s;
      }),
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-info" />
          Storyline Attack Reconstruction
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Automatically correlates processes, files, and network events into
          visual attack narratives with MITRE ATT&CK mapping.
        </p>
      </div>

      {storylines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <BookOpen className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Attack Storylines Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing attack storylines. Data will appear here automatically.
          </p>
        </div>
      ) : (
      <>
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={BookOpen} label="Active Investigations" value={stats.active} color="text-info" />
        <StatCard icon={AlertTriangle} label="Critical Storylines" value={stats.critical} color="text-red-400" />
        <StatCard icon={Activity} label="Avg Events / Storyline" value={stats.avgEvents} color="text-green-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
          >
            <option value="all">All</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
          >
            <option value="all">All</option>
            {SEVERITY_FILTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Storyline cards */}
      <div className="space-y-4">
        {filtered.map((s) => (
          <StorylineCard
            key={s.id}
            storyline={s}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            onAction={(action) => handleAction(s.id, action)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="h-8 w-8 text-neutral-600 mb-3" />
            <p className="text-neutral-400 text-sm">No storylines match current filters.</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof BookOpen; label: string; value: number; color: string;
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
