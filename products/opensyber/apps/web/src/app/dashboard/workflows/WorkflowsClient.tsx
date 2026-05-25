'use client';

import { useState } from 'react';
import { Workflow as WorkflowIcon } from 'lucide-react';
import type { Workflow, WorkflowRun } from './types';
import { WorkflowStatsRow } from './WorkflowStatsRow';
import { WorkflowCard } from './WorkflowCard';
import { RecentRunsTable } from './RecentRunsTable';

type StatusFilter = 'all' | 'active' | 'inactive' | 'draft';

const FILTERS: StatusFilter[] = ['all', 'active', 'inactive', 'draft'];

export function WorkflowsClient(): React.ReactElement {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, _setRuns] = useState<WorkflowRun[]>([]);

  const filtered = filter === 'all'
    ? workflows
    : workflows.filter((w) => w.status === filter);

  const totalRuns = workflows.reduce((s, w) => s + w.runCount, 0);
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const successRate = runs.length > 0
    ? Math.round((completedRuns / runs.length) * 100)
    : 0;

  function handleToggle(id: string): void {
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, status: w.status === 'active' ? 'inactive' : 'active' as const }
          : w
      )
    );
  }

  function handleRun(id: string): void {
    alert(`Workflow ${id} triggered manually`);
  }

  function handleEdit(id: string): void {
    alert(`Edit workflow ${id}`);
  }

  function handleCreate(): void {
    alert('Create Workflow — builder coming soon');
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <WorkflowIcon className="h-8 w-8 text-info" />
            SOAR Workflows
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Automate security response with visual workflows. Define
            triggers, chain actions, and reduce mean time to response.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg px-4 py-2 text-sm bg-info text-white hover:bg-info transition shrink-0"
        >
          Create Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <WorkflowIcon className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Workflows Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Create automation workflows to respond to security events automatically. Workflows will appear here once configured.
          </p>
        </div>
      ) : (
        <>
          <WorkflowStatsRow
            activeCount={workflows.filter((w) => w.status === 'active').length}
            totalRuns={totalRuns}
            avgDuration="0s"
            successRate={successRate}
          />

          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                  filter === f
                    ? 'bg-info text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filtered.map((w) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                onToggle={handleToggle}
                onRun={handleRun}
                onEdit={handleEdit}
              />
            ))}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center">
                <WorkflowIcon className="mx-auto h-10 w-10 text-neutral-600" />
                <p className="mt-3 text-sm text-neutral-400">
                  No {filter} workflows found.
                </p>
              </div>
            )}
          </div>

          <RecentRunsTable runs={runs} workflows={workflows} />
        </>
      )}
    </div>
  );
}
