import { api, type Project } from '../../hooks/useApi';
import EmptyProjectsState from '../EmptyProjectsState';
import PlatformIcon from '../PlatformIcon';
import { SkeletonTable } from '../Skeleton';
import { useToast } from '../Toast';
import { formatDate } from './utils';
import { cardClassName } from './utils';

interface Props {
  projects: Project[];
  loading: boolean;
  selectedProjectId: string | null;
  disconnecting: string | null;
  onSelect: (id: string) => void;
  onAfterDisconnect: () => Promise<void> | void;
  onDisconnectStart: (id: string | null) => void;
}

export default function ProjectsList({
  projects,
  loading,
  selectedProjectId,
  disconnecting,
  onSelect,
  onAfterDisconnect,
  onDisconnectStart,
}: Props) {
  const { toast, confirm } = useToast();

  async function handleDisconnect(project: Project) {
    const ok = await confirm(
      'Disconnect Project',
      `Disconnect ${project.repo}? This removes all runs, runners, and memberships.`,
    );
    if (!ok) return;
    onDisconnectStart(project.id);
    try {
      await api.disconnectProject(project.id);
      toast({ type: 'success', title: 'Project disconnected', message: project.repo });
      await onAfterDisconnect();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to disconnect',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      onDisconnectStart(null);
    }
  }

  return (
    <section className={cardClassName()}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Accessible Projects</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Only repos where you have an explicit project membership appear here.
          </p>
        </div>
      </div>
      {loading ? (
        <SkeletonTable rows={3} />
      ) : projects.length === 0 ? (
        <EmptyProjectsState />
      ) : (
        <div role="list" className="grid gap-3">
          {projects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            const isDisconnecting = disconnecting === project.id;
            return (
              <div
                key={project.id}
                role="listitem"
                className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all duration-150 ${
                  isSelected
                    ? 'border-emerald-500/40 bg-emerald-500/[0.07] shadow-[0_0_20px_-6px_rgba(16,185,129,0.25)]'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  aria-pressed={isSelected}
                  className="flex flex-1 items-center gap-4 text-left"
                >
                  <PlatformIcon platform={project.platform} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-100">{project.repo}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      Connected {formatDate(project.created_at)}
                    </div>
                  </div>
                  <span className="rounded-full border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {project.platform}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnect(project)}
                  disabled={isDisconnecting}
                  aria-busy={isDisconnecting}
                  title="Disconnect project"
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? '…' : 'Disconnect'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
