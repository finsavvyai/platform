'use client';

import type { WorkflowRun, Workflow } from './types';

const RUN_STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  running: 'bg-info/20 text-info',
};

interface Props {
  runs: WorkflowRun[];
  workflows: Workflow[];
}

export function RecentRunsTable({ runs, workflows }: Props): React.ReactElement {
  const wfMap = new Map(workflows.map((w) => [w.id, w.name]));

  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Recent Runs</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900/50 border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Workflow</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Started</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {runs.map((r) => {
              const pct = r.totalSteps > 0 ? (r.stepsCompleted / r.totalSteps) * 100 : 0;
              return (
                <tr key={r.id} className="hover:bg-neutral-800/30 transition">
                  <td className="px-4 py-3 font-medium">{wfMap.get(r.workflowId) ?? r.workflowId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${RUN_STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-xs font-mono">{r.duration}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.status === 'failed' ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500">
                        {r.stepsCompleted}/{r.totalSteps}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
