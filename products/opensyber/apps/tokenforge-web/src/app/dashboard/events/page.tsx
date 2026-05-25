'use client';

import { useCallback } from 'react';
import { Activity } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchEvents } from '@/lib/tokenforge-api';
import { EventsFeed } from '@/components/dashboard/EventsFeed';
import type { SecurityEvent } from '@/components/dashboard/types';

export default function EventsPage(): React.ReactElement {
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchEvents(token, signal),
    [],
  );
  const { data: events, loading } = useApi<SecurityEvent[]>(fetcher);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Security Events</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Real-time security events from your TokenForge integration
        </p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      ) : !events || events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-panel/20 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <Activity className="h-8 w-8 text-info" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No events yet</h2>
          <p className="mb-6 max-w-md text-sm text-text-secondary">
            Security events will appear here once sessions are verified
            through the TokenForge SDK.
          </p>
        </div>
      ) : (
        <EventsFeed events={events} />
      )}
    </div>
  );
}
