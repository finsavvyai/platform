import { ShieldCheck } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Security Policies' };

interface SecurityPolicy {
  id: string;
  instanceId: string;
  policyType: string;
  name: string;
  rules: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const policyTypeLabels: Record<string, string> = {
  network_allowlist: 'Network Allowlist',
  network_blocklist: 'Network Blocklist',
  file_path_rules: 'File Path Rules',
  shell_command_rules: 'Shell Command Rules',
  ip_allowlist: 'IP Allowlist',
  rate_limit: 'Rate Limit',
};

function parseRulesPreview(rules: string): string {
  try {
    const parsed = JSON.parse(rules);
    if (Array.isArray(parsed)) {
      return `${parsed.length} rule${parsed.length !== 1 ? 's' : ''}`;
    }
    const keys = Object.keys(parsed);
    return `${keys.length} setting${keys.length !== 1 ? 's' : ''}`;
  } catch {
    return 'Custom rules';
  }
}

export default async function PoliciesPage() {
  let policies: SecurityPolicy[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const data = await apiClient<{ policies: SecurityPolicy[] }>(
          `/api/security/instances/${instance.id}/policies`, { token },
        );
        policies = data.policies;
      }
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Security Policies</h1>
        <p className="text-sm text-text-secondary mt-1">Manage security policies for your AI agent instance</p>
      </div>

      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <ShieldCheck className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No policies</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Create security policies to control network access, file paths, shell commands, and more for your instance.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((policy) => (
            <div key={policy.id} className="rounded border border-border bg-panel/30 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-neutral-200">{policy.name}</h3>
                  <p className="text-xs text-text-dim mt-0.5">
                    {policyTypeLabels[policy.policyType] ?? policy.policyType}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${policy.isActive ? 'bg-green-500/10 text-green-400' : 'bg-surface text-text-dim'}`}>
                  {policy.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-dim border-t border-border pt-3">
                <span>{parseRulesPreview(policy.rules)}</span>
                <span>Updated {formatDate(policy.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
