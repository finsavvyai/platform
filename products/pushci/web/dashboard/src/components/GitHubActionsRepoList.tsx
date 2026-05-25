// GitHubActionsRepoList — searchable list of repos available to a
// GitHub Actions connection. Each row shows the last workflow run
// status as a colored chip.
// License: Apache-2.0

import { useMemo, useState } from 'react';
import type { GHARepo, GHAConclusion } from '../hooks/useGitHubActionsBridge';
import { SkeletonRow } from './Skeleton';
import { btnGestureSubtle } from '../styles/gestures';

interface Props {
  repos: GHARepo[];
  loading: boolean;
  error?: string | null;
  selectedFullName: string | null;
  onSelect: (repo: GHARepo) => void;
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
  stale: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

function conclusionLabel(c: GHAConclusion, status?: string): { label: string; cls: string } {
  if (c) {
    return {
      label: c.replace('_', ' '),
      cls: CONCLUSION_STYLES[c] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    };
  }
  if (status && status !== 'completed') {
    return { label: status.replace('_', ' '), cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  }
  return { label: 'no runs', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' };
}

export default function GitHubActionsRepoList({
  repos, loading, error, selectedFullName, onSelect,
}: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [repos, query]);

  return (
    <section className={card} aria-label="Repositories">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-zinc-100">Repositories</h3>
        <input
          type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter repos…" aria-label="Filter repos"
          className="w-48 bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-1"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-zinc-500">
          {repos.length === 0 ? 'No repositories visible to this connection.' : 'No repos match that filter.'}
        </p>
      ) : (
        <ul className="space-y-1 max-h-96 overflow-y-auto">
          {filtered.map((r) => {
            const active = selectedFullName === r.full_name;
            const { label, cls } = conclusionLabel(r.last_run?.conclusion ?? null, r.last_run?.status);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${btnGestureSubtle} ${
                    active
                      ? 'bg-accent/10 text-zinc-100 border border-accent/30'
                      : 'text-zinc-300 hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{r.name}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 font-mono truncate flex items-center gap-2">
                    <span>{r.full_name}</span>
                    {r.private && <span className="text-[10px] uppercase tracking-wide text-zinc-500">private</span>}
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
