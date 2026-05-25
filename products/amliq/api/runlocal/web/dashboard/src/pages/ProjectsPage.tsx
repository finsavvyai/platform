import { useProjects } from '../hooks/useProjects';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import PlatformIcon from '../components/PlatformIcon';

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, loading, error } = useProjects();

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Connected repositories"
        action={
          <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
            Add Project
          </button>
        }
      />
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm mb-4">
          {error} — showing cached data
        </div>
      )}
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-4 py-3 rounded-lg border border-surface-border bg-surface-card hover:border-zinc-600 transition-colors"
            >
              <PlatformIcon platform={p.platform} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-zinc-100">{p.repo}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Connected {p.connectedDate}
                </div>
              </div>
              <StatusBadge status={p.lastRunStatus} size="sm" />
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-12">
              No projects connected yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
