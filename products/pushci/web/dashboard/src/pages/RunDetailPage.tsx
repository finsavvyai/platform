import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRunDetail } from '../hooks/useRuns';
import { useLogs } from '../hooks/useLogs';
import { api } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import LogViewer from '../components/LogViewer';
import LiveLogViewer from '../components/LiveLogViewer';
import CheckRow from '../components/CheckRow';
import FixMyPipeline from '../components/FixMyPipeline';
import PipelineFlow from '../components/PipelineFlow';
import PRFlowChart from '../components/PRFlowChart';
import ImpactGraph from '../components/ImpactGraph';
import { useToast } from '../components/Toast';
import { SkeletonTable, SkeletonCard } from '../components/Skeleton';

type ActionKind = 'rerun' | 'cancel' | null;

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { run, loading, error, refresh } = useRunDetail(runId);
  const isActive = run?.status === 'running';
  const { logs, connected } = useLogs(isActive ? runId ?? null : null);
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<ActionKind>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard height="h-16" />
        <SkeletonTable rows={4} />
        <SkeletonCard height="h-32" />
      </div>
    );
  }
  if (error || !run) {
    return (
      <div className="text-center py-10 sm:py-16 md:py-20 text-zinc-500" role="alert">
        <p>{error || 'Run not found.'}</p>
        <Link to="/runs" className="text-emerald-400 text-sm mt-2 inline-block">
          Back to runs
        </Link>
      </div>
    );
  }

  const fullLog =
    run.logs || run.checks.map((c) => `=== ${c.name} ===\n${c.output}`).join('\n\n');

  async function handleRerun() {
    if (!runId || pendingAction) return;
    setPendingAction('rerun');
    try {
      await api.rerun(runId);
      toast({ type: 'success', title: 'Re-run triggered' });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({ type: 'error', title: 'Re-run failed', message });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCancel() {
    if (!runId || pendingAction) return;
    setPendingAction('cancel');
    try {
      await api.cancelRun(runId);
      toast({ type: 'success', title: 'Run cancelled' });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({ type: 'error', title: 'Cancel failed', message });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div>
      <Link to="/runs" className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        &larr; Back to runs
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{run.repo}</h1>
            <p className="text-xs text-zinc-500 truncate">
              {run.branch} &middot;{' '}
              <code className="font-mono text-zinc-400 select-all" title={run.commitSha}>
                {run.commitSha}
              </code>{' '}
              &middot; {run.duration}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {run.status === 'failed' && <FixMyPipeline runId={runId!} />}
          {isActive && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={pendingAction !== null}
              aria-busy={pendingAction === 'cancel'}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pendingAction === 'cancel' ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={handleRerun}
            disabled={pendingAction !== null}
            aria-busy={pendingAction === 'rerun'}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pendingAction === 'rerun' ? 'Re-running…' : 'Re-run'}
          </button>
        </div>
      </div>
      {run.commitMsg && <p className="text-sm text-zinc-300 mb-6">{run.commitMsg}</p>}

      {run.checks.length > 0 && (
        <div className="mb-8 p-5 rounded-xl border border-surface-border bg-surface-card/50">
          <PipelineFlow steps={run.checks} status={run.status} />
        </div>
      )}

      <div className="mb-6">
        <PRFlowChart pr={{
          branch: run.branch,
          title: run.commitMsg || `Changes on ${run.branch}`,
          author: run.repo.split('/')[0],
          status: run.status === 'passed' ? 'merged' : run.status === 'running' ? 'review' : 'open',
          checksStatus: run.status === 'cancelled' ? 'pending' : run.status,
          reviewers: ['auto-review'],
        }} />
      </div>

      <div className="mb-6">
        <ImpactGraph repo={run.repo} sha={run.commitSha} changedFiles={run.checks.map((c) => c.name)} />
      </div>

      <h2 className="text-sm font-medium text-zinc-400 mb-3">Checks</h2>
      <div className="space-y-2 mb-8">
        {run.checks.map((c) => <CheckRow key={c.name} check={c} />)}
      </div>
      <h2 className="text-sm font-medium text-zinc-400 mb-3">
        {isActive ? 'Live Logs' : 'Full Log'}
      </h2>
      {isActive ? (
        <LiveLogViewer logs={logs} connected={connected} />
      ) : (
        <LogViewer output={fullLog} />
      )}
    </div>
  );
}
