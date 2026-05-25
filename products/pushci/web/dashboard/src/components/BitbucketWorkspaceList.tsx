// BitbucketWorkspaceList — two-column list: workspaces on the left,
// repositories on the right. Drives the orchestrator's selection state.
// License: Apache-2.0

import type { BitbucketRepo, BitbucketWorkspace } from '../hooks/useBitbucketBridge';
import { SkeletonRow } from './Skeleton';
import { btnGestureSubtle } from '../styles/gestures';

interface Props {
  workspaces: BitbucketWorkspace[];
  repos: BitbucketRepo[];
  selectedWorkspace: string | null;
  selectedRepo: string | null;
  loadingWorkspaces: boolean;
  loadingRepos: boolean;
  error?: string | null;
  onSelectWorkspace: (slug: string) => void;
  onSelectRepo: (slug: string) => void;
}

const card = 'rounded-xl border border-surface-border bg-surface-card p-4';

export default function BitbucketWorkspaceList({
  workspaces, repos, selectedWorkspace, selectedRepo,
  loadingWorkspaces, loadingRepos, error,
  onSelectWorkspace, onSelectRepo,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card} aria-label="Workspaces">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">Workspaces</h3>
        {loadingWorkspaces ? (
          <div className="space-y-1"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
        ) : workspaces.length === 0 ? (
          <p className="text-xs text-zinc-500">No workspaces visible to this connection.</p>
        ) : (
          <ul className="space-y-1">
            {workspaces.map((w) => {
              const active = selectedWorkspace === w.slug;
              return (
                <li key={w.slug}>
                  <button
                    type="button"
                    onClick={() => onSelectWorkspace(w.slug)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${btnGestureSubtle} ${
                      active
                        ? 'bg-accent/10 text-zinc-100 border border-accent/30'
                        : 'text-zinc-300 hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{w.slug}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card} aria-label="Repositories">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">Repositories</h3>
        {!selectedWorkspace ? (
          <p className="text-xs text-zinc-500">Select a workspace to list its repositories.</p>
        ) : loadingRepos ? (
          <div className="space-y-1"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
        ) : error ? (
          <p role="alert" className="text-xs text-red-400">{error}</p>
        ) : repos.length === 0 ? (
          <p className="text-xs text-zinc-500">This workspace has no repositories.</p>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {repos.map((r) => {
              const active = selectedRepo === r.slug;
              return (
                <li key={r.slug}>
                  <button
                    type="button"
                    onClick={() => onSelectRepo(r.slug)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${btnGestureSubtle} ${
                      active
                        ? 'bg-accent/10 text-zinc-100 border border-accent/30'
                        : 'text-zinc-300 hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{r.name}</span>
                      {r.is_private && (
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500 ml-2">private</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono truncate">{r.full_name}</div>
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
