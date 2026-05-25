import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Server } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Admin — Instances' };

interface InstanceRow {
  id: string;
  name: string;
  ownerEmail: string | null;
  status: string;
  region: string | null;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    running: 'bg-green-500/20 text-green-400',
    stopped: 'bg-neutral-500/20 text-text-secondary',
    creating: 'bg-signal/20 text-signal',
    error: 'bg-red-500/20 text-red-400',
  };
  return map[status] ?? 'bg-neutral-500/20 text-text-secondary';
}

export default async function AdminInstancesPage() {
  const token = await getApiToken();

  let instances: InstanceRow[] = [];
  try {
    if (token) {
      const data = await apiClient<{ data: InstanceRow[] }>('/api/admin/instances', { token });
      instances = data.data;
    }
  } catch (err) { console.error('[AdminInstances] Failed to fetch instances:', err instanceof Error ? err.message : err); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Instances</h1>
        <p className="mt-1 text-sm text-text-secondary">All deployed agent instances</p>
      </div>

      {instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Server className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instances</h3>
          <p className="text-sm text-text-secondary">Instances will appear here once deployed.</p>
        </div>
      ) : (
        <div className="rounded border border-border bg-panel/30 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Owner</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Region</th>
                <th className="px-6 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {instances.map((inst) => (
                <tr key={inst.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3 font-medium">{inst.name}</td>
                  <td className="px-6 py-3 text-text-secondary">{inst.ownerEmail ?? '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(inst.status)}`}>
                      {inst.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-secondary">{inst.region ?? '—'}</td>
                  <td className="px-6 py-3 text-text-dim">{formatDate(inst.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
