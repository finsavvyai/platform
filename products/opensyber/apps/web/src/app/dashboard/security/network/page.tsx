import { Globe, ShieldAlert } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Network Activity' };

interface NetworkEntry {
  id: string;
  domain: string;
  method: string;
  path: string;
  statusCode: number;
  action: 'allowed' | 'blocked';
  createdAt: string;
}

export default async function NetworkActivityPage() {
  let entries: NetworkEntry[] = [];

  let hasInstance = true;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const data = await apiClient<{ activity: NetworkEntry[] }>(
          `/api/security/instances/${instance.id}/network-activity`,
          { token },
        );
        entries = data.activity ?? [];
      } else {
        hasInstance = false;
      }
    }
  } catch {
    // API not available
  }

  if (!hasInstance) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Network Activity</h1>
        <p className="text-sm text-text-secondary mb-8">Monitor outbound network requests from your AI agent</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Globe className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instance deployed</h3>
          <p className="text-sm text-text-secondary max-w-sm">Deploy an instance to monitor network activity.</p>
        </div>
      </div>
    );
  }

  const totalRequests = entries.length;
  const blockedCount = entries.filter((e) => e.action === 'blocked').length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Network Activity</h1>
        <p className="text-sm text-text-secondary mt-1">Monitor outbound network requests from your AI agent</p>
      </div>

      {/* Summary */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-border bg-panel/30 p-6">
          <p className="text-sm text-text-secondary mb-2">Total Requests</p>
          <p className="text-3xl font-bold">{totalRequests}</p>
        </div>
        <div className="rounded border border-border bg-panel/30 p-6">
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
            <ShieldAlert className="h-4 w-4" />
            Blocked
          </div>
          <p className={`text-3xl font-bold ${blockedCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {blockedCount}
          </p>
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Globe className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No network activity</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Network requests will appear here once your agent starts making outbound calls.
          </p>
        </div>
      ) : (
        <div className="rounded border border-border bg-panel/30 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Domain</th>
                <th className="px-6 py-3 font-medium">Method</th>
                <th className="px-6 py-3 font-medium">Path</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={
                    entry.action === 'blocked'
                      ? 'bg-red-500/5 hover:bg-red-500/10 transition'
                      : 'hover:bg-surface/30 transition'
                  }
                >
                  <td className="px-6 py-3 font-mono text-xs">{entry.domain}</td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">
                      {entry.method}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-secondary max-w-xs truncate font-mono text-xs">
                    {entry.path}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs">{entry.statusCode}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.action === 'allowed'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
