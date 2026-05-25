'use client';

import { KeyRound } from 'lucide-react';
import type { AccessSummary, ActiveSession, PendingRequest, HistoricalRequest } from './types';
import { AccessSummaryCards } from './AccessSummaryCards';
import { RequestAccessForm } from './RequestAccessForm';
import { PendingRequestsTable } from './PendingRequestsTable';
import { ActiveSessionsTable } from './ActiveSessionsTable';
import { RequestHistory } from './RequestHistory';

const emptySummary: AccessSummary = {
  activeSessions: 0,
  pendingRequests: 0,
  requestsToday: 0,
};

const emptyActiveSessions: ActiveSession[] = [];
const emptyPendingRequests: PendingRequest[] = [];
const emptyHistory: HistoricalRequest[] = [];

export default function AccessRequestsClient(): React.ReactElement {
  const hasData = emptyActiveSessions.length > 0
    || emptyPendingRequests.length > 0
    || emptyHistory.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <KeyRound className="h-8 w-8 text-info" />
          Access Requests
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage just-in-time access requests, active sessions, and request history.
        </p>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <KeyRound className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Access Requests Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start managing access requests. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <AccessSummaryCards summary={emptySummary} />
          <RequestAccessForm />
          <ActiveSessionsTable sessions={emptyActiveSessions} />
          <PendingRequestsTable requests={emptyPendingRequests} />
          <RequestHistory requests={emptyHistory} />
        </>
      )}
    </div>
  );
}
