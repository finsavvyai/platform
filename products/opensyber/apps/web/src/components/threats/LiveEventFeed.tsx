'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ThreatEvent {
  eventType: string;
  severity: string;
  sourceCountry: string | null;
  createdAt: string;
}

interface LiveEventFeedProps {
  events: ThreatEvent[];
}

const severityBorder: Record<string, string> = {
  critical: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-info',
};

const severityBadge: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  warning: 'bg-amber-500/10 text-amber-400',
  info: 'bg-signal/10 text-signal',
};

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    code.charCodeAt(0) + 127397,
    code.charCodeAt(1) + 127397,
  );
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LiveEventFeed({ events }: LiveEventFeedProps) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Live Event Feed</h3>
      {events.length === 0 ? (
        <p className="text-sm text-text-dim">No recent events detected.</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {events.map((event, i) => (
              <motion.div
                key={`${event.createdAt}-${i}`}
                className={`flex items-center justify-between rounded-lg border-l-2 bg-panel/50 px-4 py-3 ${severityBorder[event.severity] ?? 'border-l-neutral-600'}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                layout
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg" title={event.sourceCountry ?? 'Unknown'}>
                    {countryFlag(event.sourceCountry) || '🌐'}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {formatEventType(event.eventType)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityBadge[event.severity] ?? 'bg-surface text-text-primary'}`}>
                    {event.severity}
                  </span>
                </div>
                <span className="text-xs text-text-dim whitespace-nowrap ml-2">
                  {timeAgo(event.createdAt)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
