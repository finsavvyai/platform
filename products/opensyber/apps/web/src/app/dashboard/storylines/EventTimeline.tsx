'use client';

import type { StorylineEvent } from './types';
import { EVENT_TYPE_COLORS, SEVERITY_COLORS } from './types';

interface EventTimelineProps {
  events: StorylineEvent[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function EventTimeline({ events }: EventTimelineProps): React.ReactElement {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400 font-medium">Event Timeline</p>

      {/* Horizontal dots bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {sorted.map((ev) => (
          <div
            key={ev.id}
            className="flex-shrink-0 w-4 h-4 rounded-full border border-neutral-700"
            style={{ backgroundColor: EVENT_TYPE_COLORS[ev.type] || '#6b7280' }}
            title={`${ev.type}: ${ev.detail}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-neutral-500 capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Event list */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {sorted.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-3 rounded-lg bg-neutral-900/50 px-3 py-2 text-xs"
          >
            <span className="text-neutral-500 w-20 flex-shrink-0 font-mono">
              {formatTime(ev.timestamp)}
            </span>
            <div
              className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: EVENT_TYPE_COLORS[ev.type] }}
            />
            <span className="text-neutral-300 flex-1">{ev.detail}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[ev.severity]}`}>
              {ev.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
