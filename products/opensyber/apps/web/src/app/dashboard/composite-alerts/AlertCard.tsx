'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CompositeAlert } from './types';
import { SEVERITY_COLORS, STATUS_COLORS } from './types';
import { CorrelationViz } from './CorrelationViz';

interface AlertCardProps {
  alert: CompositeAlert;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: 'acknowledge' | 'dismiss') => void;
}

function confidenceBadge(score: number): string {
  if (score >= 90) return 'bg-red-500/20 text-red-400';
  if (score >= 75) return 'bg-amber-500/20 text-amber-400';
  return 'bg-info/20 text-info';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function AlertCard({
  alert: a, expanded, onToggle, onAction,
}: AlertCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-6 text-left hover:bg-neutral-800/20 transition"
      >
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-neutral-500">{a.id}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${confidenceBadge(a.confidence)}`}>
              {a.confidence}% confidence
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status]}`}>
              {a.status}
            </span>
          </div>
          <p className="text-sm font-medium text-neutral-200">{a.title}</p>
          <p className="text-xs text-neutral-500 line-clamp-2">{a.narrative}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {a.mitreTactics.map((t) => (
              <span key={t} className="rounded bg-info/10 text-info px-2 py-0.5 text-[10px] font-medium">
                {t}
              </span>
            ))}
            <span className="text-xs text-neutral-500">{a.events.length} events</span>
            <span className="text-xs text-neutral-500">{a.timeSpan}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-neutral-800 p-6 space-y-6">
          <CorrelationViz events={a.events} />

          {/* Event list */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {a.events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-3 rounded-lg bg-neutral-900/50 px-3 py-2 text-xs"
              >
                <span className="text-neutral-500 w-14 flex-shrink-0 font-mono">
                  {formatTime(ev.timestamp)}
                </span>
                <span className="text-neutral-500 w-28 flex-shrink-0">{ev.source}</span>
                <span className="text-neutral-300 flex-1">{ev.detail}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[ev.severity]}`}>
                  {ev.severity}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onAction('acknowledge')}
              className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30 transition"
            >
              Acknowledge
            </button>
            <button
              onClick={() => onAction('dismiss')}
              className="rounded-lg bg-neutral-700/50 px-4 py-2 text-xs font-medium text-neutral-400 hover:bg-neutral-700/70 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
