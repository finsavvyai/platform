import { SeverityIcon, SeverityBadge } from './demo-helpers';
import type { LiveEvent } from './demo-constants';

interface EventsTabProps {
  events: LiveEvent[];
}

export function EventsTab({ events }: EventsTabProps): React.ReactElement {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Security Events</h2>
          <p className="text-sm text-text-dim mt-0.5">{events.length} events captured</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-text-dim">Live</span>
        </div>
      </div>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-500 ${
              event.isNew
                ? 'bg-signal/10 border border-info/20 scale-[1.01]'
                : 'bg-surface/30 hover:bg-surface/50'
            }`}
          >
            <SeverityIcon severity={event.severity} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{event.message}</p>
            </div>
            <SeverityBadge severity={event.severity} />
            <span className="text-xs text-text-dim tabular-nums w-20 text-right shrink-0">{event.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
