// BitbucketPipelineBrowser — last N pipelines for a repo with status chips.
// Includes a "Trigger run" action that accepts branch/tag ref input.
// License: Apache-2.0

import { useState } from 'react';
import type { BitbucketPipelineSummary, BitbucketStatus } from '../hooks/useBitbucketBridge';
import { SkeletonRow } from './Skeleton';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';

interface Props {
  pipelines: BitbucketPipelineSummary[];
  loading: boolean;
  error?: string | null;
  onTrigger: (ref: string, refType: 'branch' | 'tag') => Promise<void>;
  triggering?: boolean;
  onRefresh?: () => void;
}

const card = 'rounded-xl border border-surface-border bg-surface-card p-4';

const STATUS_STYLES: Record<BitbucketStatus, string> = {
  passed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  running: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  halted: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  stopped: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  unknown: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

function StatusChip({ status }: { status: BitbucketStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function fmtDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function BitbucketPipelineBrowser({
  pipelines, loading, error, onTrigger, triggering = false, onRefresh,
}: Props) {
  const [ref, setRef] = useState('main');
  const [refType, setRefType] = useState<'branch' | 'tag'>('branch');

  async function handleTrigger() {
    if (!ref.trim() || triggering) return;
    await onTrigger(ref.trim(), refType);
  }

  return (
    <section className={card} aria-label="Pipelines">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Recent pipelines</h3>
          <p className="text-xs text-zinc-500">Last 20 runs · polled live from Bitbucket</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={refType} onChange={(e) => setRefType(e.target.value as 'branch' | 'tag')}
            className="bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-zinc-200"
            aria-label="Ref type">
            <option value="branch">branch</option>
            <option value="tag">tag</option>
          </select>
          <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main"
            aria-label="Ref name"
            className="w-32 bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent/50" />
          <button type="button" onClick={handleTrigger} disabled={triggering || !ref.trim()}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}>
            {triggering ? 'Triggering…' : 'Trigger run'}
          </button>
          {onRefresh && (
            <button type="button" onClick={onRefresh}
              className={`px-3 py-1.5 rounded-lg text-xs text-zinc-300 border border-surface-border ${btnGestureSubtle}`}>
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-1"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      ) : pipelines.length === 0 ? (
        <p className="text-xs text-zinc-500">No pipelines found for this repository yet.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {pipelines.map((p) => (
            <li key={p.uuid} className="py-2.5 grid grid-cols-[auto_1fr_auto] gap-3 items-center">
              <span className="font-mono text-xs text-zinc-400 w-12 text-right">#{p.build_number}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusChip status={p.status} />
                  <span className="text-xs text-zinc-300 truncate">{p.ref ?? '(detached)'}</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono truncate">
                  {p.commit ? p.commit.slice(0, 8) : '—'} · {new Date(p.created_on).toLocaleString()}
                </div>
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">{fmtDuration(p.duration)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
