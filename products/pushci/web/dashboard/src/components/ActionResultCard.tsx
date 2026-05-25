// Renders the result of a dispatched chat action.
// Handles success / error / polling / stub states with appropriate UI.

import type { ActionResult } from '../lib/chatActionDispatcher';

interface RunSummary {
  id: string;
  repo: string;
  branch: string;
  status: string;
  created_at: string;
  duration_ms?: number;
}

function extractDisplayText(data: unknown): { kind: 'text' | 'yaml' | 'json'; body: string } {
  if (!data || typeof data !== 'object') {
    return { kind: 'text', body: String(data ?? '') };
  }
  const d = data as Record<string, unknown>;
  // Prefer human-readable fields in priority order
  for (const k of ['optimization', 'diagnosis', 'analysis', 'message', 'text']) {
    if (typeof d[k] === 'string') return { kind: 'text', body: d[k] as string };
  }
  for (const k of ['yaml', 'pipeline', 'config']) {
    if (typeof d[k] === 'string') return { kind: 'yaml', body: d[k] as string };
  }
  return { kind: 'json', body: JSON.stringify(d, null, 2) };
}

function RunsList({ runs }: { runs: RunSummary[] }) {
  if (!runs.length) {
    return <p className="text-sm text-zinc-400">No recent runs to show.</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {runs.slice(0, 10).map((r) => {
        const color =
          r.status === 'succeeded' ? 'text-emerald-400'
          : r.status === 'failed' ? 'text-red-400'
          : r.status === 'running' ? 'text-amber-400'
          : 'text-zinc-400';
        return (
          <li key={r.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="font-mono truncate text-zinc-300">{r.repo}@{r.branch?.slice(0, 12)}</span>
            <span className={`font-semibold ${color}`}>{r.status}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ActionResultCard({ result }: { result: ActionResult }) {
  if (result.state === 'stub') {
    return (
      <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-300">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">In development</span>
        </div>
        <p className="text-zinc-300 leading-relaxed">{result.message}</p>
      </div>
    );
  }

  if (result.state === 'error') {
    return (
      <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-red-400">Failed</span>
        </div>
        <p className="text-zinc-300 leading-relaxed">{result.error}</p>
      </div>
    );
  }

  if (result.state === 'polling') {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Running</span>
        </div>
        {result.runId && (
          <p className="mt-1 text-xs text-zinc-500 font-mono">run id: {result.runId}</p>
        )}
      </div>
    );
  }

  // success
  const data = result.data as Record<string, unknown> | undefined;
  if (data && Array.isArray((data as { runs?: unknown }).runs)) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Status</span>
        </div>
        <RunsList runs={(data as { runs: RunSummary[] }).runs} />
      </div>
    );
  }

  const display = extractDisplayText(data);
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Result</span>
      </div>
      {display.kind === 'text' ? (
        <p className="whitespace-pre-wrap text-zinc-200 leading-relaxed">{display.body}</p>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs font-mono text-zinc-200">
          <code>{display.body}</code>
        </pre>
      )}
    </div>
  );
}
