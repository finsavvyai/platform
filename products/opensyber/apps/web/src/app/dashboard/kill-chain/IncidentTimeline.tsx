'use client';

import { Clock, AlertTriangle, Info, CheckCircle } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  summary: string;
  stage: string;
}

interface IncidentTimelineProps {
  events: TimelineEvent[];
}

const severityIcons = {
  critical: <AlertTriangle className="h-5 w-5 text-red-500" />,
  high: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  medium: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  low: <Info className="h-5 w-5 text-signal" />,
  info: <Info className="h-5 w-5 text-signal" />,
};

const severityColors = {
  critical: 'bg-red-500/20 border-l-2 border-red-500',
  high: 'bg-orange-500/20 border-l-2 border-orange-500',
  medium: 'bg-yellow-500/20 border-l-2 border-yellow-500',
  low: 'bg-signal/20 border-l-2 border-info',
  info: 'bg-signal/20 border-l-2 border-info',
};

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <p className="text-gray-400">No events in timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="relative">
          {/* Vertical connector line */}
          {index < events.length - 1 && (
            <div className="absolute left-6 top-12 h-8 w-0.5 bg-gray-700" />
          )}

          {/* Event card */}
          <div className={`rounded-lg p-4 ${severityColors[event.severity]} relative ml-16`}>
            {/* Icon circle */}
            <div className="absolute -left-9 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 border border-gray-700">
              {severityIcons[event.severity]}
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white">{event.eventType}</h4>
                  <span className="text-xs px-2 py-0.5 bg-black/30 rounded text-gray-300">
                    {event.stage}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-2">{event.summary}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 ml-4">
                <Clock className="h-3 w-3" />
                {new Date(event.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
