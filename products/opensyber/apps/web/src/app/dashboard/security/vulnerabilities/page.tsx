import { Bug, ShieldCheck } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Vulnerabilities' };

interface Vulnerability {
  id: string;
  cveId: string;
  packageName: string;
  version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'fixed' | 'ignored' | 'false_positive';
  createdAt: string;
}

const severityBadge: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-signal/10 text-signal',
};

const statusBadge: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  in_progress: 'bg-yellow-500/10 text-yellow-400',
  fixed: 'bg-green-500/10 text-green-400',
  ignored: 'bg-surface text-text-secondary',
  false_positive: 'bg-surface text-text-secondary',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  fixed: 'Fixed',
  ignored: 'Ignored',
  false_positive: 'False Positive',
};

export default async function VulnerabilitiesPage() {
  let vulnerabilities: Vulnerability[] = [];

  let hasInstance = true;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const data = await apiClient<{ vulnerabilities: Vulnerability[] }>(
          `/api/security/instances/${instance.id}/vulnerabilities`,
          { token },
        );
        vulnerabilities = data.vulnerabilities;
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
        <h1 className="text-2xl font-bold mb-2">Vulnerabilities</h1>
        <p className="text-sm text-text-secondary mb-8">Track and manage security vulnerabilities</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Bug className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instance deployed</h3>
          <p className="text-sm text-text-secondary max-w-sm">Deploy an instance to scan for vulnerabilities.</p>
        </div>
      </div>
    );
  }

  const counts = {
    critical: vulnerabilities.filter((v) => v.severity === 'critical').length,
    high: vulnerabilities.filter((v) => v.severity === 'high').length,
    medium: vulnerabilities.filter((v) => v.severity === 'medium').length,
    low: vulnerabilities.filter((v) => v.severity === 'low').length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Vulnerabilities</h1>
        <p className="text-sm text-text-secondary mt-1">Track and manage security vulnerabilities</p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400 mb-1">Critical</p>
          <p className="text-3xl font-bold text-red-400">{counts.critical}</p>
        </div>
        <div className="rounded border border-orange-500/20 bg-orange-500/5 p-6 text-center">
          <p className="text-sm text-orange-400 mb-1">High</p>
          <p className="text-3xl font-bold text-orange-400">{counts.high}</p>
        </div>
        <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
          <p className="text-sm text-yellow-400 mb-1">Medium</p>
          <p className="text-3xl font-bold text-yellow-400">{counts.medium}</p>
        </div>
        <div className="rounded border border-info/20 bg-info/5 p-6 text-center">
          <p className="text-sm text-signal mb-1">Low</p>
          <p className="text-3xl font-bold text-signal">{counts.low}</p>
        </div>
      </div>

      {/* Table */}
      {vulnerabilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <ShieldCheck className="h-6 w-6 text-green-400" />
          </div>
          <h3 className="text-base font-semibold mb-1">No vulnerabilities found</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Your instance is clean. Vulnerabilities will appear here if detected during scans.
          </p>
        </div>
      ) : (
        <div className="rounded border border-border bg-panel/30 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">CVE ID</th>
                <th className="px-6 py-3 font-medium">Package</th>
                <th className="px-6 py-3 font-medium">Version</th>
                <th className="px-6 py-3 font-medium">Severity</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {vulnerabilities.map((vuln) => (
                <tr key={vuln.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3 font-mono text-xs">{vuln.cveId}</td>
                  <td className="px-6 py-3 font-medium">{vuln.packageName}</td>
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary">{vuln.version}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        severityBadge[vuln.severity] ?? 'bg-surface text-text-primary'
                      }`}
                    >
                      {vuln.severity}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusBadge[vuln.status] ?? 'bg-surface text-text-primary'
                      }`}
                    >
                      {statusLabel[vuln.status] ?? vuln.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-dim whitespace-nowrap">
                    {formatDate(vuln.createdAt)}
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
