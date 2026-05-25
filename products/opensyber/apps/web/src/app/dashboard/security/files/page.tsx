import { FileSearch, FileWarning } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'File Integrity' };

interface FileBaseline {
  id: string;
  filePath: string;
  sha256: string;
  lastVerifiedAt: string;
}

interface FileEvent {
  id: string;
  filePath: string;
  changeType: 'modified' | 'created' | 'deleted' | 'permissions_changed';
  createdAt: string;
}

const changeTypeBadge: Record<string, string> = {
  modified: 'bg-yellow-500/10 text-yellow-400',
  created: 'bg-green-500/10 text-green-400',
  deleted: 'bg-red-500/10 text-red-400',
  permissions_changed: 'bg-signal/10 text-signal',
};

const changeTypeLabel: Record<string, string> = {
  modified: 'Modified',
  created: 'Created',
  deleted: 'Deleted',
  permissions_changed: 'Permissions Changed',
};

export default async function FileIntegrityPage() {
  let baselines: FileBaseline[] = [];
  let events: FileEvent[] = [];

  let hasInstance = true;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const [baselineData, eventData] = await Promise.all([
          apiClient<{ baselines: FileBaseline[] }>(
            `/api/security/instances/${instance.id}/file-baselines`,
            { token },
          ),
          apiClient<{ events: FileEvent[] }>(
            `/api/security/instances/${instance.id}/file-events`,
            { token },
          ),
        ]);
        baselines = baselineData.baselines;
        events = eventData.events;
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
        <h1 className="text-2xl font-bold mb-2">File Integrity</h1>
        <p className="text-sm text-text-secondary mb-8">Monitor critical file changes on your AI agent instance</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <FileSearch className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instance deployed</h3>
          <p className="text-sm text-text-secondary max-w-sm">Deploy an instance to monitor file integrity.</p>
        </div>
      </div>
    );
  }

  const hasData = baselines.length > 0 || events.length > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">File Integrity</h1>
        <p className="text-sm text-text-secondary mt-1">Monitor critical file changes on your AI agent instance</p>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <FileSearch className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No file integrity data</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            File baselines and change events will appear here once monitoring is configured.
          </p>
        </div>
      ) : (
        <>
          {/* Monitored Files */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Monitored Files</h3>
            {baselines.length === 0 ? (
              <div className="rounded border border-border bg-panel/30 p-6">
                <p className="text-sm text-text-dim">No file baselines configured.</p>
              </div>
            ) : (
              <div className="rounded border border-border bg-panel/30 overflow-hidden">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-secondary">
                      <th className="px-6 py-3 font-medium">File Path</th>
                      <th className="px-6 py-3 font-medium">SHA-256</th>
                      <th className="px-6 py-3 font-medium">Last Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {baselines.map((baseline) => (
                      <tr key={baseline.id} className="hover:bg-surface/30 transition">
                        <td className="px-6 py-3 font-mono text-xs">{baseline.filePath}</td>
                        <td className="px-6 py-3 font-mono text-xs text-text-secondary" title={baseline.sha256}>
                          {baseline.sha256.slice(0, 16)}&hellip;
                        </td>
                        <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                          {formatDate(baseline.lastVerifiedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>

          {/* Change Log */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-text-secondary" />
              Change Log
            </h3>
            {events.length === 0 ? (
              <div className="rounded border border-border bg-panel/30 p-6">
                <p className="text-sm text-text-dim">No file change events recorded.</p>
              </div>
            ) : (
              <div className="rounded border border-border bg-panel/30 overflow-hidden">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-secondary">
                      <th className="px-6 py-3 font-medium">File Path</th>
                      <th className="px-6 py-3 font-medium">Change Type</th>
                      <th className="px-6 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-surface/30 transition">
                        <td className="px-6 py-3 font-mono text-xs">{event.filePath}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              changeTypeBadge[event.changeType] ?? 'bg-surface text-text-primary'
                            }`}
                          >
                            {changeTypeLabel[event.changeType] ?? event.changeType}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                          {formatDate(event.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
