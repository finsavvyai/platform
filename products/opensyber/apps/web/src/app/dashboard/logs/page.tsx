import { ScrollText } from 'lucide-react';
import { Suspense } from 'react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ExportAuditButton } from '@/components/dashboard/security/ExportAuditButton';
import { DateRangeFilter } from './DateRangeFilter';

export const metadata = { title: 'Audit Logs' };

interface AuditEntry {
  id: string;
  instanceId: string;
  action: string;
  skillId: string | null;
  details: string | null;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  shell_exec: 'Shell Execution', file_read: 'File Read',
  file_write: 'File Write', http_request: 'HTTP Request',
  credential_access: 'Credential Access', skill_install: 'Skill Install',
  skill_uninstall: 'Skill Uninstall', config_change: 'Config Change',
};

function sevenDaysAgo(): string {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

const today = () => new Date().toISOString().slice(0, 10);
const pill = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-signal text-white' : 'bg-surface text-text-secondary hover:bg-neutral-700'}`;

type SearchParams = { action?: string; page?: string; from?: string; to?: string };

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filterAction = params.action ?? null;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 25;
  const from = params.from ?? sevenDaysAgo();
  const to = params.to ?? today();

  let logs: AuditEntry[] = [];
  let instanceId: string | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{
        instances: Array<{ id: string }>;
      }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const qs = new URLSearchParams({ from, to }).toString();
        const data = await apiClient<{ auditLog: AuditEntry[] }>(
          `/api/security/instances/${instance.id}/audit?${qs}`,
          { token },
        );
        logs = data.auditLog;
      }
    }
  } catch {
    // API not available
  }

  const filteredLogs = filterAction
    ? logs.filter((l) => l.action === filterAction)
    : logs;

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const buildHref = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...extra });
    return `/dashboard/logs?${p.toString()}`;
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-text-secondary mt-1">
            Complete log of all actions taken by your AI agent
          </p>
        </div>
        {instanceId && <ExportAuditButton instanceId={instanceId} />}
      </div>

      <Suspense fallback={null}>
        <DateRangeFilter />
      </Suspense>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <ScrollText className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No audit logs</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Audit logs will appear here once your agent starts executing actions.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-text-secondary">Filter:</span>
            <div className="flex flex-wrap gap-2">
              <a href={buildHref({})} className={pill(!filterAction)}>All</a>
              {uniqueActions.map((action) => (
                <a key={action} href={buildHref({ action })} className={pill(filterAction === action)}>
                  {actionLabels[action] ?? action}
                </a>
              ))}
            </div>
          </div>

          <div className="rounded border border-border bg-panel/30 overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Skill</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {paginatedLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface/30 transition">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-text-secondary">
                      {entry.skillId || '\u2014'}
                    </td>
                    <td className="px-6 py-3 text-text-secondary max-w-md truncate font-mono text-xs">
                      {entry.details || '\u2014'}
                    </td>
                    <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
              <span>Page {page} of {totalPages} ({filteredLogs.length} entries)</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={buildHref({ ...(filterAction ? { action: filterAction } : {}), page: String(page - 1) })}
                    className="rounded-lg bg-surface px-3 py-1.5 text-xs hover:bg-neutral-700 transition">Previous</a>
                )}
                {page < totalPages && (
                  <a href={buildHref({ ...(filterAction ? { action: filterAction } : {}), page: String(page + 1) })}
                    className="rounded-lg bg-surface px-3 py-1.5 text-xs hover:bg-neutral-700 transition">Next</a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
