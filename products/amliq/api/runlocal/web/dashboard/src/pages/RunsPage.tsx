import { useRuns } from '../hooks/useRuns';
import PageHeader from '../components/PageHeader';
import RunRow from '../components/RunRow';

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
        <Spinner />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
          {runs.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-12">
              No runs yet. Push a commit to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
