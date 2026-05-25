import Link from 'next/link';
import { Zap, Plus } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Playbook } from './types';
import { statusColors, triggerLabels } from './types';

export const metadata = { title: 'Remediation Playbooks' };

export default async function PlaybooksPage() {
  let playbooks: Playbook[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ playbooks: Playbook[] }>(
        '/api/remediation/playbooks',
        { token },
      );
      playbooks = data.playbooks ?? [];
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Remediation Playbooks</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Automated response playbooks for security events
          </p>
        </div>
        <Link
          href="/dashboard/security/playbooks?create=true"
          className="inline-flex items-center gap-2 bg-info hover:bg-info text-white rounded-lg px-4 py-2 text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" />
          Create Playbook
        </Link>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        {playbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
              <Zap className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">No playbooks yet</h3>
            <p className="text-sm text-neutral-400 max-w-sm">
              Create your first automated response playbook.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-400">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Trigger</th>
                  <th className="pb-3 font-medium">Steps</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Last Run</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {playbooks.map((pb) => (
                  <tr key={pb.id} className="group">
                    <td className="py-3">
                      <Link
                        href={`/dashboard/security/playbooks/${pb.id}`}
                        className="font-medium text-neutral-200 hover:text-white transition"
                      >
                        {pb.name}
                      </Link>
                    </td>
                    <td className="py-3 text-neutral-400">
                      {triggerLabels[pb.triggerType] ?? pb.triggerType}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center rounded-full bg-info/10 text-info px-2 py-0.5 text-xs font-medium">
                        {pb.steps?.length ?? 0}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[pb.status] ?? 'bg-neutral-800 text-neutral-300'}`}>
                        {pb.status}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-500 whitespace-nowrap">
                      {pb.lastRunAt ? formatDate(pb.lastRunAt) : 'Never'}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/dashboard/security/playbooks/${pb.id}`}
                        className="text-info hover:text-info text-xs transition"
                      >
                        View
                      </Link>
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
