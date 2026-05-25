import { btnGestureSubtle } from '../../styles/gestures';
import type { GerritProject } from './types';

interface Props {
  project: GerritProject;
  testResult: string | undefined;
  testing: boolean;
  deleting: boolean;
  onTest: (id: string) => void;
  onRemove: (project: GerritProject) => void;
}

export default function GerritProjectCard({
  project: p,
  testResult,
  testing,
  deleting,
  onTest,
  onRemove,
}: Props) {
  const isOk = testResult?.startsWith('OK') ?? false;
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{p.project}</h3>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{p.host}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {p.pollEnabled ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
              Polling {p.pollIntervalSec ?? 300}s
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-700/30 text-zinc-400">
              Webhook
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-500 space-y-1">
        <div>User: <span className="text-zinc-300">{p.httpUser}</span></div>
        <div>
          Created:{' '}
          <span className="text-zinc-300">{new Date(p.createdAt).toLocaleDateString()}</span>
        </div>
        {testResult && (
          <div
            role="status"
            aria-live="polite"
            className={isOk ? 'text-emerald-400' : 'text-red-400'}
          >
            {testResult}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onTest(p.id)}
          disabled={testing}
          aria-busy={testing}
          className={`px-3 py-1.5 rounded-lg border border-surface-border bg-surface-hover/40 text-xs text-zinc-200 hover:text-emerald-400 disabled:opacity-60 ${btnGestureSubtle}`}
        >
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(p)}
          disabled={deleting}
          aria-busy={deleting}
          className={`px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-60 ${btnGestureSubtle}`}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
