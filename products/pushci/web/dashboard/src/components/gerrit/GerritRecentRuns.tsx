import type { RunSummary } from '../../hooks/useApi';

const STATUS_CHIP: Record<string, string> = {
  passed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
};

function chipClass(status: RunSummary['status']): string {
  return STATUS_CHIP[status] ?? 'bg-zinc-700/30 text-zinc-300';
}

export default function GerritRecentRuns({ runs }: { runs: RunSummary[] }) {
  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-300 mb-3">Recent Gerrit runs</h2>
      {runs.length === 0 ? (
        <div className="p-4 rounded-lg border border-surface-border bg-surface-card/60 text-xs text-zinc-500">
          No Gerrit-triggered runs yet. Push a patchset to a registered project to see one here.
        </div>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-surface-border bg-surface-card/60 text-xs"
            >
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${chipClass(r.status)}`}>
                {r.status}
              </span>
              <span className="text-zinc-200 truncate flex-1">{r.repo}</span>
              <span className="text-zinc-500 hidden sm:inline">{r.branch}</span>
              <span className="text-zinc-500">{(r.trigger ?? '').replace('gerrit:', '')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
