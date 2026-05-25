'use client';

import { Check, X, Clock } from 'lucide-react';
import type { PendingRequest } from './types';
import { LevelBadge } from './AccessBadges';

interface PendingRequestsTableProps {
  requests: PendingRequest[];
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function PendingRequestsTable({ requests }: PendingRequestsTableProps): React.ReactElement {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-8 text-center mb-8">
        <Clock className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
        <p className="text-neutral-300">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Pending Requests</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="p-4 font-medium">Requester</th>
              <th className="p-4 font-medium">Resource</th>
              <th className="p-4 font-medium">Level</th>
              <th className="p-4 font-medium">Duration</th>
              <th className="p-4 font-medium">Justification</th>
              <th className="p-4 font-medium">Time</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-neutral-800/30 transition">
                <td className="p-4 font-medium text-neutral-200">{req.requester}</td>
                <td className="p-4 text-neutral-300">{req.resource}</td>
                <td className="p-4"><LevelBadge level={req.level} /></td>
                <td className="p-4 text-neutral-300">{req.duration}</td>
                <td className="p-4 text-neutral-400 text-xs max-w-xs truncate" title={req.justification}>
                  {req.justification}
                  {req.ticketRef && (
                    <span className="ml-2 text-info">[{req.ticketRef}]</span>
                  )}
                </td>
                <td className="p-4 text-neutral-500 text-xs">{formatTime(req.requestedAt)}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-green-600 p-1.5 text-white hover:bg-green-500 transition" aria-label="Approve">
                      <Check className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg bg-red-600 p-1.5 text-white hover:bg-red-500 transition" aria-label="Deny">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
