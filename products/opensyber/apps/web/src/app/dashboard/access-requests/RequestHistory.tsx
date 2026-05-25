'use client';

import { History } from 'lucide-react';
import type { HistoricalRequest } from './types';
import { LevelBadge, StatusBadge } from './AccessBadges';

interface RequestHistoryProps {
  requests: HistoricalRequest[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function RequestHistory({ requests }: RequestHistoryProps): React.ReactElement {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-8 text-center">
        <History className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
        <p className="text-neutral-300">No request history</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Request History</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="p-4 font-medium">Requester</th>
              <th className="p-4 font-medium">Resource</th>
              <th className="p-4 font-medium">Level</th>
              <th className="p-4 font-medium">Duration</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Processed By</th>
              <th className="p-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-neutral-800/30 transition">
                <td className="p-4 font-medium text-neutral-200">{req.requester}</td>
                <td className="p-4 text-neutral-300">{req.resource}</td>
                <td className="p-4"><LevelBadge level={req.level} /></td>
                <td className="p-4 text-neutral-300">{req.duration}</td>
                <td className="p-4"><StatusBadge status={req.status} /></td>
                <td className="p-4 text-neutral-400">{req.processedBy}</td>
                <td className="p-4 text-neutral-500 text-xs whitespace-nowrap">{formatDate(req.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
