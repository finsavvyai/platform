'use client';

import type { InboxItem } from './types';
import { CATEGORY_COLORS, CATEGORY_LABELS, SEVERITY_COLORS, scoreColor } from './types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface InboxCardProps {
  item: InboxItem;
  onInvestigate: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function InboxCard({ item, onInvestigate, onSnooze, onDismiss }: InboxCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition hover:border-neutral-700">
      <div className="flex items-start gap-4">
        {/* Priority score badge */}
        <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold ${scoreColor(item.score)}`}>
          {item.score}
        </div>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium mb-1.5">{item.title}</h3>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[item.category]}`}>
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="text-[10px] text-neutral-500">{item.source}</span>
            <span className="text-[10px] text-neutral-500 font-mono">{item.resource}</span>
          </div>
          {item.status === 'in_progress' && (
            <div className="h-1 w-full rounded-full bg-neutral-800 mt-1">
              <div className="h-1 w-1/3 rounded-full bg-info" />
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_COLORS[item.severity]}`}>
            {item.severity}
          </span>
          <span className="text-[10px] text-neutral-500">{timeAgo(item.firstSeen)}</span>
          <div className="flex gap-1.5 mt-1">
            <button onClick={() => onInvestigate(item.id)} className="rounded-lg bg-info/10 px-3 py-1 text-xs font-medium text-info hover:bg-info/20 transition">
              Investigate
            </button>
            <button onClick={() => onSnooze(item.id)} className="rounded-lg bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-400 hover:bg-neutral-700 transition">
              Snooze
            </button>
            <button onClick={() => onDismiss(item.id)} className="rounded-lg bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-700 transition">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
