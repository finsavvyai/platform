import Link from 'next/link';
import { History } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { PlaybookRun } from '../types';
import { statusColors } from '../types';

export const metadata = { title: 'Execution History' };

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'In progress';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export default async function ExecutionHistoryPage() {
  let runs: PlaybookRun[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ runs: PlaybookRun[] }>(
        '/api/remediation/runs',
        { token },
      );
      runs = data.runs ?? [];
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Execution History</h1>
        <p className="text-sm text-neutral-400 mt-1">
          View all playbook execution runs
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
              <History className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">No execution history</h3>
            <p className="text-sm text-neutral-400 max-w-sm">
              Run a playbook to see execution history here.
            </p>
            <Link href="/dashboard/security/playbooks"
              className="mt-4 inline-flex items-center bg-info hover:bg-info text-white rounded-lg px-4 py-2 text-sm font-medium transition">
              View Playbooks
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-400">
                  <th className="pb-3 font-medium">Playbook</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Started</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Steps</th>
                  <th className="pb-3 font-medium">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {runs.map((run) => (
                  <tr key={run.id} className="group">
                    <td className="py-3">
                      <Link
                        href={`/dashboard/security/playbooks/${run.playbookId}`}
                        className="font-medium text-neutral-200 hover:text-white transition"
                      >
                        {run.playbookName ?? run.playbookId}
                      </Link>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[run.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-500 whitespace-nowrap">
                      {formatDate(run.startedAt ?? run.createdAt)}
                    </td>
                    <td className="py-3 text-neutral-400 whitespace-nowrap">
                      {formatDuration(run.startedAt ?? run.createdAt, run.completedAt)}
                    </td>
                    <td className="py-3 text-neutral-400">
                      {run.stepsCompleted}/{run.stepsTotal}
                    </td>
                    <td className="py-3 text-neutral-400">
                      {run.triggeredBy ?? 'system'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
