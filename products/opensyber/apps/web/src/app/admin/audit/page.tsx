import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Admin — Unified Audit' };

interface AuditEntry {
  id: string;
  timestamp: string;
  source: 'audit' | 'security';
  type: string;
  severity: string;
  actorId: string | null;
  instanceId: string | null;
  details: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-cyan-500/20 text-cyan-400',
  info: 'bg-gray-500/20 text-gray-400',
};

const SOURCE_COLORS: Record<string, string> = {
  audit: 'bg-info/20 text-info',
  security: 'bg-amber-500/20 text-amber-400',
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const token = await getApiToken();
  if (!token) return <p className="text-gray-500">Unauthorized</p>;

  const query = new URLSearchParams();
  if (params.source) query.set('source', params.source);
  if (params.severity) query.set('severity', params.severity);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  query.set('limit', '50');

  let entries: AuditEntry[] = [];
  try {
    const res = await apiClient<{ data: AuditEntry[] }>(
      `/api/admin/audit?${query.toString()}`,
      { token },
    );
    entries = res.data ?? [];
  } catch {
    return <p className="text-gray-500">Failed to load audit data.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unified Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            System-wide view of audit entries and security events.
          </p>
        </div>
        <a
          href={`/api/proxy/admin/audit/export?${query.toString()}`}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10
                     text-sm text-gray-400 hover:text-white transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {(['audit', 'security'] as const).map((s) => (
          <a
            key={s}
            href={`/admin/audit?source=${s}`}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors
              ${params.source === s
                ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
        <a
          href="/admin/audit"
          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors
            ${!params.source
              ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
              : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'}`}
        >
          All
        </a>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No audit entries found.</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Instance</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {formatDate(e.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[e.source]}`}>
                      {e.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{e.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_COLORS[e.severity] ?? SEVERITY_COLORS.info}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[100px]">
                    {e.actorId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[100px]">
                    {e.instanceId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[200px]">
                    {e.details ?? '—'}
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
