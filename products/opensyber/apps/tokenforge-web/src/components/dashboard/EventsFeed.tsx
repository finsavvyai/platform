'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SecurityEvent } from './types';

const severityStyles: Record<string, { border: string; badge: string }> = {
  info: {
    border: 'border-l-info',
    badge: 'bg-info/10 text-info',
  },
  warning: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  critical: {
    border: 'border-l-red-500',
    badge: 'bg-red-500/10 text-red-400',
  },
};

const EVENT_TYPES = ['All', 'session.verified', 'trust_score.degraded', 'session.hijack_attempt', 'session.bound', 'key.rotated', 'trust_score.critical'];
const SEVERITIES = ['All', 'info', 'warning', 'critical'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const PAGE_SIZE = 5;

interface EventsFeedProps {
  events: SecurityEvent[];
}

export function EventsFeed({ events }: EventsFeedProps): React.ReactElement {
  const [typeFilter, setTypeFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = events.filter((e) => {
    if (typeFilter !== 'All' && e.type !== typeFilter) return false;
    if (severityFilter !== 'All' && e.severity !== severityFilter) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div>
      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 focus:border-signal focus:outline-none"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 focus:border-signal focus:outline-none"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Severities' : s}</option>
          ))}
        </select>
        <span className="flex items-center text-xs text-neutral-500">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Event Cards */}
      <div className="space-y-3">
        {visible.map((event) => {
          const style = severityStyles[event.severity] ?? severityStyles.info;
          const isExpanded = expandedId === event.id;

          return (
            <div
              key={event.id}
              className={`rounded-xl border border-neutral-800 border-l-4 ${style.border} bg-neutral-900 p-4`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                    {event.severity}
                  </span>
                  <span className="font-mono text-sm text-neutral-300">{event.type}</span>
                  {event.country && (
                    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs font-medium text-neutral-300">
                      {event.country}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{formatTime(event.timestamp)}</span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white transition"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-neutral-400">{event.message}</p>

              {isExpanded && (
                <div className="mt-3 space-y-1 rounded-lg bg-neutral-800/50 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">IP</span>
                    <span className="font-mono text-neutral-300">{event.ip}</span>
                  </div>
                  {event.deviceId && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Device</span>
                      <span className="font-mono text-neutral-300">{event.deviceId}</span>
                    </div>
                  )}
                  {Object.entries(event.details).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-neutral-500">{key}</span>
                      <span className="text-neutral-300">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info transition"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
