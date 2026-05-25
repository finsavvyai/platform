import Link from 'next/link';
import { Bell, ArrowLeft } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { CreateAlertRuleForm } from './CreateAlertRuleForm';

export const metadata = { title: 'Alert Rules' };

interface AlertRule {
  id: string;
  name: string;
  eventType: string;
  severityFilter: string | null;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export default async function AlertRulesPage() {
  let alertRules: AlertRule[] = [];
  let instanceId: string | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const data = await apiClient<{ alertRules: AlertRule[] }>(
          `/api/security/instances/${instance.id}/alert-rules`, { token },
        );
        alertRules = data.alertRules;
      }
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard/security/alerts"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-neutral-200 transition mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Alerts
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alert Rules</h1>
            <p className="text-sm text-text-secondary mt-1">Configure rules that trigger alerts based on security events</p>
          </div>
        </div>
      </div>

      {instanceId && <CreateAlertRuleForm instanceId={instanceId} />}

      {alertRules.length === 0 && !instanceId ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Bell className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">Deploy an instance first</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Alert rules require a running agent instance. Deploy one from the dashboard to get started.
          </p>
          <Link href="/dashboard" className="mt-4 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition">
            Go to Dashboard
          </Link>
        </div>
      ) : alertRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Bell className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No alert rules yet</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Use the form above to create your first alert rule.
          </p>
        </div>
      ) : (
        <div className="rounded border border-border bg-panel/30 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Event Type</th>
                  <th className="pb-3 font-medium">Severity Filter</th>
                  <th className="pb-3 font-medium">Threshold</th>
                  <th className="pb-3 font-medium">Window (min)</th>
                  <th className="pb-3 font-medium">Cooldown (min)</th>
                  <th className="pb-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {alertRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-3 font-medium text-neutral-200">{rule.name}</td>
                    <td className="py-3 font-mono text-xs text-text-primary">{rule.eventType}</td>
                    <td className="py-3 text-text-secondary">{rule.severityFilter ?? '\u2014'}</td>
                    <td className="py-3 text-text-primary">{rule.threshold}</td>
                    <td className="py-3 text-text-primary">{rule.windowMinutes}</td>
                    <td className="py-3 text-text-primary">{rule.cooldownMinutes}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          rule.isActive
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
