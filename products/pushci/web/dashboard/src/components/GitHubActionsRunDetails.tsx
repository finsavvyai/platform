// GitHubActionsRunDetails — jobs panel for a selected run. Lists jobs
// with their steps and conclusion chips, plus a link to GitHub logs.
// License: Apache-2.0

import type { GHAConclusion, GHARunDetail, GHAStep } from '../hooks/useGitHubActionsBridge';
import { SkeletonRow } from './Skeleton';

interface Props {
  detail: GHARunDetail | null;
  loading: boolean;
  error?: string | null;
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
};

function chip(c: GHAConclusion, status: string): { label: string; cls: string } {
  if (c) return { label: c.replace('_', ' '), cls: CONCLUSION_STYLES[c] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
  return { label: status.replace('_', ' '), cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
}

function StepRow({ step }: { step: GHAStep }) {
  const { label, cls } = chip(step.conclusion, step.status);
  return (
    <li className="flex items-center gap-2 py-1 text-xs">
      <span className="w-6 text-right font-mono text-zinc-500 tabular-nums">{step.number}</span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
        {label}
      </span>
      <span className="text-zinc-300 truncate">{step.name}</span>
    </li>
  );
}

export default function GitHubActionsRunDetails({ detail, loading, error }: Props) {
  if (loading) {
    return (
      <section className={card} aria-label="Run details">
        <div className="space-y-1"><SkeletonRow /><SkeletonRow /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={card} aria-label="Run details">
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className={card} aria-label="Run details">
        <p className="text-xs text-zinc-500">Select a run to inspect jobs and step statuses.</p>
      </section>
    );
  }

  const { run, jobs } = detail;
  const runChip = chip(run.conclusion, run.status);

  return (
    <section className={card} aria-label="Run details">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Run #{run.run_number}</h3>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${runChip.cls}`}>
              {runChip.label}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono truncate">
            {run.head_branch ?? '(detached)'} · {run.head_sha.slice(0, 8)} · {run.event}
          </p>
        </div>
        {run.html_url && (
          <a href={run.html_url} target="_blank" rel="noreferrer"
            className="text-xs text-emerald-400 hover:underline">
            View logs on GitHub ↗
          </a>
        )}
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-zinc-500">No jobs reported for this run yet.</p>
      ) : (
        <ul className="space-y-4" aria-label="Jobs">
          {jobs.map((j) => {
            const jc = chip(j.conclusion, j.status);
            return (
              <li key={j.id} className="rounded-lg border border-surface-border p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${jc.cls}`}>
                      {jc.label}
                    </span>
                    <span className="text-sm text-zinc-200 truncate">{j.name}</span>
                  </div>
                  {j.html_url && (
                    <a href={j.html_url} target="_blank" rel="noreferrer"
                      className="text-[11px] text-zinc-400 hover:text-emerald-400">
                      logs ↗
                    </a>
                  )}
                </div>
                {j.steps.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">No step output.</p>
                ) : (
                  <ul>{j.steps.map((s) => <StepRow key={`${j.id}-${s.number}`} step={s} />)}</ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
