'use client';

import { useCallback } from 'react';
import { Monitor } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchSessions } from '@/lib/tokenforge-api';
import { SessionsTable } from '@/components/dashboard/SessionsTable';
import type { Session } from '@/components/dashboard/types';

export default function SessionsPage(): React.ReactElement {
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchSessions(token, signal),
    [],
  );
  const { data: sessions, loading, refetch } = useApi<Session[]>(fetcher);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Device Sessions</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage cryptographically bound device sessions
        </p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      ) : !sessions || sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-panel/20 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <Monitor className="h-8 w-8 text-info" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No sessions yet</h2>
          <p className="mb-6 max-w-md text-sm text-text-secondary">
            Sessions will appear here once devices are bound using the
            TokenForge SDK.
          </p>
        </div>
      ) : (
        <SessionsTable sessions={sessions} onRevoke={refetch} />
      )}
    </div>
  );
}
