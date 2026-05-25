// Renders pipeline details plus the job list for a selected project,
// and exposes a trigger control. Strictly presentational.
import { useState } from 'react';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';
import { SkeletonRow } from './Skeleton';
import type {
  BridgeStatus,
  GitLabJob,
  GitLabPipelineDetail,
  GitLabPipelineSummary,
  GitLabProject,
} from '../hooks/useGitLabBridge';

interface Props {
  project: GitLabProject;
  pipelines: GitLabPipelineSummary[];
  selectedPipeline: GitLabPipelineDetail | null;
  jobs: GitLabJob[];
  loading: boolean;
  triggering: boolean;
  error?: string | null;
  onSelectPipeline: (id: number) => void;
  onTrigger: (ref: string) => Promise<void> | void;
  onOpenImport: () => void;
}

const DOT: Record<BridgeStatus, string> = {
  passed: 'text-emerald-400',
  running: 'text-sky-400',
  pending: 'text-zinc-400',
  failed: 'text-red-400',
  cancelled: 'text-amber-400',
};

function StatusBadge({ status }: { status: BridgeStatus }) {
  return <span className={`font-mono text-xs ${DOT[status]}`}>{status}</span>;
}

export default function GitLabPipelinePreview({
  project, pipelines, selectedPipeline, jobs, loading, triggering, error,
  onSelectPipeline, onTrigger, onOpenImport,
}: Props) {
  const [ref, setRef] = useState(project.default_branch ?? 'main');

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-5" aria-label="Pipeline preview">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{project.name}</h3>
          <div className="text-xs text-zinc-500 font-mono truncate">{project.path}</div>
        </div>
        <button
          type="button"
          onClick={onOpenImport}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border bg-surface-card text-zinc-200 hover:bg-surface-hover ${btnGestureSubtle}`}
        >
          Import .gitlab-ci.yml
        </button>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (ref.trim()) onTrigger(ref.trim()); }}
        className="flex items-end gap-3"
      >
        <div className="flex-1 max-w-xs">
          <label htmlFor="gitlab-ref" className="block text-xs text-zinc-400 mb-1">Ref</label>
          <input
            id="gitlab-ref"
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-accent/50"
          />
        </div>
        <button
          type="submit"
          disabled={triggering || !ref.trim()}
          className={`px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
        >
          {triggering ? 'Triggering…' : 'Trigger pipeline'}
        </button>
      </form>

      {error && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Recent pipelines</div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : pipelines.length === 0 ? (
          <div className="text-xs text-zinc-500 py-6 text-center">No pipelines yet for this project.</div>
        ) : (
          <ul className="space-y-1">
            {pipelines.slice(0, 8).map((p) => {
              const active = selectedPipeline?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPipeline(p.id)}
                    aria-pressed={active}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      active ? 'border-accent/40 bg-accent/5' : 'border-transparent hover:border-surface-border hover:bg-surface-hover'
                    }`}
                  >
                    <span className="text-xs font-mono text-zinc-300 truncate">#{p.id} · {p.ref}</span>
                    <StatusBadge status={p.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedPipeline && (
        <div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Jobs for pipeline #{selectedPipeline.id}
          </div>
          {jobs.length === 0 ? (
            <div className="text-xs text-zinc-500 py-4 text-center">No jobs reported.</div>
          ) : (
            <ul className="space-y-1">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-surface/50">
                  <span className="text-zinc-200 truncate">{j.name}</span>
                  <span className="text-zinc-500 font-mono truncate">{j.stage}</span>
                  <StatusBadge status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
