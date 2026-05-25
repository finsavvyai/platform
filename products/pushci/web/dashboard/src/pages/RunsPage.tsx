import { useRuns } from '../hooks/useRuns';
import PageHeader from '../components/PageHeader';
import RunRow from '../components/RunRow';
import EmptyRunsState from '../components/EmptyRunsState';
import { SkeletonTable } from '../components/Skeleton';
import UpgradeBanner from '../components/UpgradeBanner';
import FreeUserWelcome from '../components/FreeUserWelcome';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm mb-4">
      {message} — showing cached data
    </div>
  );
}

export default function RunsPage() {
  const { runs, loading, error, refresh } = useRuns();

  return (
    <div>
      <FreeUserWelcome />
      <UpgradeBanner message="Unlock AI diagnosis and cloud runners" planRequired="pro" />
      <PageHeader
        title="CI Runs"
        description="Recent pipeline executions across all projects"
        action={
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
          >
            Refresh
          </button>
        }
      />
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
          {runs.length === 0 && <EmptyRunsState />}
        </div>
      )}
    </div>
  );
}
