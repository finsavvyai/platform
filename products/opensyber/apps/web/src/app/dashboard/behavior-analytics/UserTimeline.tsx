'use client';

import { X, LogIn, Database, Shield, AlertTriangle } from 'lucide-react';
import type { TimelineEvent } from './types';

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

const ICON_MAP: Record<string, typeof LogIn> = {
  login: LogIn,
  data_access: Database,
  permission_change: Shield,
  anomaly: AlertTriangle,
};

function EventRow({ event }: { event: TimelineEvent }): React.ReactElement {
  const Icon = ICON_MAP[event.type] ?? LogIn;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        event.isAnomalous
          ? 'bg-red-500/10 border border-red-500/20'
          : 'hover:bg-neutral-800/30'
      }`}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 ${
          event.isAnomalous ? 'text-red-400' : 'text-neutral-500'
        }`}
      />
      <span className={event.isAnomalous ? 'text-red-400 font-medium' : 'text-neutral-300'}>
        {event.label}
      </span>
      <span className="ml-auto text-xs text-neutral-500">
        {new Date(event.time).toLocaleDateString()}
      </span>
    </div>
  );
}

export function UserTimeline({
  userId: _userId,
  userName,
  onClose,
}: Props): React.ReactElement {
  const events: TimelineEvent[] = [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{userName}</h3>
            <p className="text-xs text-neutral-400">
              30-day behavior timeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No timeline events available.</p>
          ) : (
            events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
