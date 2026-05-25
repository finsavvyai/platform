import { useParams, Link } from 'react-router-dom';
import { useRunDetail } from '../hooks/useRuns';
import { useLogs } from '../hooks/useLogs';
import { api } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import LogViewer from '../components/LogViewer';
import LiveLogViewer from '../components/LiveLogViewer';
import CheckRow from '../components/CheckRow';
import FixMyPipeline from '../components/FixMyPipeline';

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { run, loading, error } = useRunDetail(runId);
  const isActive = run?.status === 'running';
  const { logs, connected } = useLogs(isActive ? runId ?? null : null);

  if (loading) return <Spinner />;
  if (error || !run) {
    return (
      <div className="text-center py-20 text-zinc-500">
        <p>{error || 'Run not found.'}</p>
        <Link to="/runs" className="text-emerald-400 text-sm mt-2 inline-block">
          Back to runs
        </Link>
      </div>
    );
  }

  const fullLog = run.checks.map(c => `=== ${c.name} ===\n${c.output}`).join('\n\n');

  async function handleRerun() {
    if (!runId) return;
    try {
      await api.rerun(runId);
      window.location.reload();
    } catch {
      alert('Re-run failed. Please try again.');
    }
  }

  return (
    <div>
      <Link to="/runs" className="text-xs text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        &larr; Back to runs
      </Link>
      <div className="flex items-center gap-4 mb-6">
        <StatusBadge status={run.status} />
        <div>
          <h1 className="text-lg font-semibold">{run.repo}</h1>
          <p className="text-xs text-zinc-500">
            {run.branch} &middot; {run.commitSha} &middot; {run.duration}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {run.status === 'failed' && <FixMyPipeline runId={runId!} />}
          <button onClick={handleRerun}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
            Re-run
          </button>
        </div>
      </div>
      {run.commitMsg && <p className="text-sm text-zinc-300 mb-6">{run.commitMsg}</p>}
      <h2 className="text-sm font-medium text-zinc-400 mb-3">Checks</h2>
      <div className="space-y-2 mb-8">
        {run.checks.map(c => <CheckRow key={c.name} check={c} />)}
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
