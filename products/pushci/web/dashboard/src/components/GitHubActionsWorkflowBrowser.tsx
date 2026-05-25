// GitHubActionsWorkflowBrowser — left column: workflows (with dispatch flag);
// right column: last 20 runs for the repo (or the selected workflow).
// License: Apache-2.0

import type { GHAWorkflow, GHARun, GHAConclusion } from '../hooks/useGitHubActionsBridge';
import { SkeletonRow } from './Skeleton';
import { btnGestureSubtle } from '../styles/gestures';

interface Props {
  workflows: GHAWorkflow[];
  runs: GHARun[];
  selectedWorkflowId: number | null;
  selectedRunId: number | null;
  loadingWorkflows: boolean;
  loadingRuns: boolean;
  error?: string | null;
  onSelectWorkflow: (id: number | null) => void;
  onSelectRun: (id: number) => void;
  onRefresh?: () => void;
}

const card = 'rounded-xl border border-surface-border bg-surface-card p-4';

const CONCLUSION_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failure: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  skipped: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  timed_out: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  action_required: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  neutral: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  stale: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

function runChip(c: GHAConclusion, status: string): { label: string; cls: string } {
  if (c) return { label: c.replace('_', ' '), cls: CONCLUSION_STYLES[c] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
  return { label: status.replace('_', ' '), cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
}

function fmtDurationMs(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function GitHubActionsWorkflowBrowser({
  workflows, runs, selectedWorkflowId, selectedRunId,
  loadingWorkflows, loadingRuns, error, onSelectWorkflow, onSelectRun, onRefresh,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <section className={card} aria-label="Workflows">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100">Workflows</h3>
          {selectedWorkflowId != null && (
            <button type="button" onClick={() => onSelectWorkflow(null)}
              className={`text-[11px] text-zinc-400 hover:text-zinc-200 ${btnGestureSubtle}`}>
              Clear
            </button>
          )}
        </div>
        {loadingWorkflows ? (
          <div className="space-y-1"><SkeletonRow /><SkeletonRow /></div>
        ) : workflows.length === 0 ? (
          <p className="text-xs text-zinc-500">No workflows in this repository yet.</p>
        ) : (
          <ul className="space-y-1">
            {workflows.map((w) => {
              const active = selectedWorkflowId === w.id;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => onSelectWorkflow(w.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${btnGestureSubtle} ${
                      active
                        ? 'bg-accent/10 text-zinc-100 border border-accent/30'
                        : 'text-zinc-300 hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{w.name}</span>
                      {w.has_workflow_dispatch && (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-400">dispatch</span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono truncate">{w.path}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card} aria-label="Runs">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Recent runs</h3>
            <p className="text-xs text-zinc-500">Last 20 runs · live from GitHub Actions</p>
          </div>
          {onRefresh && (
            <button type="button" onClick={onRefresh}
              className={`px-3 py-1.5 rounded-lg text-xs text-zinc-300 border border-surface-border ${btnGestureSubtle}`}>
              Refresh
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}

        {loadingRuns ? (
          <div className="space-y-1"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
        ) : runs.length === 0 ? (
          <p className="text-xs text-zinc-500">No runs yet for this selection.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {runs.map((r) => {
              const chip = runChip(r.conclusion, r.status);
              const active = selectedRunId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRun(r.id)}
                    aria-current={active ? 'true' : undefined}
                    aria-label={`Run ${r.run_number} ${chip.label}`}
                    className={`w-full text-left py-2.5 grid grid-cols-[auto_1fr_auto] gap-3 items-center px-1 rounded-lg ${btnGestureSubtle} ${
                      active ? 'bg-accent/10' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className="font-mono text-xs text-zinc-400 w-12 text-right">#{r.run_number}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${chip.cls}`}>
                          {chip.label}
                        </span>
                        <span className="text-xs text-zinc-300 truncate">{r.head_branch ?? '(detached)'}</span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{r.event}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono truncate">
                        {r.head_sha.slice(0, 8)} · {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-500 tabular-nums">{fmtDurationMs(r.duration_ms)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
