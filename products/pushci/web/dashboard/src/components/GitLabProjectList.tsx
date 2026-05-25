// Searchable project list for a selected GitLab connection. Rows show
// the default branch and the latest pipeline status as a colored dot.
import { useEffect, useMemo, useState } from 'react';
import { SkeletonRow } from './Skeleton';
import type {
  BridgeStatus,
  GitLabProject,
  GitLabPipelineSummary,
} from '../hooks/useGitLabBridge';

interface Props {
  projects: GitLabProject[];
  latestByProject?: Record<number, GitLabPipelineSummary | undefined>;
  loading: boolean;
  error?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (project: GitLabProject) => void;
  selectedId?: number | null;
}

const DOT: Record<BridgeStatus, string> = {
  passed: 'bg-emerald-400',
  running: 'bg-sky-400 animate-pulse',
  pending: 'bg-zinc-500',
  failed: 'bg-red-400',
  cancelled: 'bg-amber-400',
};

function StatusDot({ status }: { status?: BridgeStatus }) {
  const cls = status ? DOT[status] : 'bg-zinc-700';
  const label = status ?? 'no pipelines yet';
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
      <span className={`inline-block w-2 h-2 rounded-full ${cls}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export default function GitLabProjectList({
  projects, latestByProject, loading, error, search, onSearchChange, onSelect, selectedId,
}: Props) {
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debounced.trim()) return projects;
    const needle = debounced.trim().toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.path.toLowerCase().includes(needle),
    );
  }, [projects, debounced]);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-4" aria-label="GitLab projects">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">Projects</h3>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by name or path"
          aria-label="Filter projects"
          className="w-60 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-xs text-zinc-500">
          {projects.length === 0 ? 'No projects available on this instance.' : 'No projects match your filter.'}
        </div>
      ) : (
        <ul className="space-y-1">
          {filtered.map((p) => {
            const latest = latestByProject?.[p.id];
            const isSelected = selectedId === p.id;
            const cls = isSelected
              ? 'border-accent/40 bg-accent/5'
              : 'border-transparent hover:border-surface-border hover:bg-surface-hover';
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  aria-pressed={isSelected}
                  className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${cls}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100 truncate">{p.name}</div>
                    <div className="text-xs text-zinc-500 font-mono truncate">{p.path}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusDot status={latest?.status} />
                    {p.default_branch && (
                      <span className="text-[10px] text-zinc-500 font-mono">{p.default_branch}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
