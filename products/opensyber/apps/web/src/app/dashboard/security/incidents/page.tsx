import Link from 'next/link';
import { AlertOctagon } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Incidents' };

interface Incident {
  id: string;
  instanceId: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  rootCause: string | null;
  remediation: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-signal/10 text-signal',
};

const statusColors: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-yellow-500/10 text-yellow-400',
  contained: 'bg-signal/10 text-signal',
  resolved: 'bg-green-500/10 text-green-400',
  closed: 'bg-surface text-text-secondary',
};

export default async function IncidentsPage() {
  let incidents: Incident[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const data = await apiClient<{ incidents: Incident[] }>(
          `/api/security/instances/${instance.id}/incidents`, { token },
        );
        incidents = data.incidents;
      }
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <p className="text-sm text-text-secondary mt-1">Track and manage security incidents</p>
      </div>

      <div className="rounded border border-border bg-panel/30 p-6">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
              <AlertOctagon className="h-6 w-6 text-text-secondary" />
            </div>
            <h3 className="text-base font-semibold mb-1">No incidents</h3>
            <p className="text-sm text-text-secondary max-w-sm">No security incidents have been recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Severity</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="group">
                    <td className="py-3">
                      <Link
                        href={`/dashboard/security/incidents/${incident.id}`}
                        className="font-medium text-neutral-200 hover:text-white transition"
                      >
                        {incident.title}
                      </Link>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[incident.severity] ?? 'bg-surface text-text-primary'}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[incident.status] ?? 'bg-surface text-text-primary'}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="py-3 text-text-dim whitespace-nowrap">{formatDate(incident.createdAt)}</td>
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
