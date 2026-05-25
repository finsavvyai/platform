'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Storyline } from './types';
import { SEVERITY_COLORS, STATUS_COLORS, VERDICT_COLORS } from './types';
import { ProcessTree } from './ProcessTree';
import { KillChainBar } from './KillChainBar';
import { EventTimeline } from './EventTimeline';

interface StorylineCardProps {
  storyline: Storyline;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: string) => void;
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs < 1) return `${Math.floor(ms / 60_000)}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function StorylineCard({
  storyline: s, expanded, onToggle, onAction,
}: StorylineCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-6 text-left hover:bg-neutral-800/20 transition"
      >
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-neutral-500">{s.id}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[s.severity]}`}>
              {s.severity}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>
              {s.status === 'Active' ? '● ' : ''}{s.status}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${VERDICT_COLORS[s.verdict]}`}>
              {s.verdict}
            </span>
          </div>
          <p className="text-sm font-medium text-neutral-200">{s.title}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {s.mitreTactics.map((t) => (
              <span key={t} className="rounded bg-info/10 text-info px-2 py-0.5 text-[10px] font-medium">
                {t}
              </span>
            ))}
            <span className="text-xs text-neutral-500">{s.eventCount} events</span>
            <span className="text-xs text-neutral-500">{timeSince(s.startTime)}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-neutral-800 p-6 space-y-6">
          <div>
            <p className="text-xs text-neutral-400 font-medium mb-3">Process Tree</p>
            <ProcessTree nodes={s.processTree} />
          </div>
          <KillChainBar activeStages={s.killChainStages} />
          <EventTimeline events={s.events} />
          <div className="flex gap-2">
            <button
              onClick={() => onAction('contain')}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30 transition"
            >
              Contain
            </button>
            <button
              onClick={() => onAction('remediate')}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/30 transition"
            >
              Remediate
            </button>
            <button
              onClick={() => onAction('benign')}
              className="rounded-lg bg-green-500/20 px-4 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 transition"
            >
              Mark Benign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
