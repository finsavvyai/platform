import { Bell, ShieldAlert } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Security Alerts' };

interface Alert {
  id: string;
  instanceId: string;
  alertRuleId: string;
  severity: string;
  title: string;
  details: string | null;
  status: string;
  triggeredCount: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

interface AlertRule {
  id: string;
  instanceId: string;
  name: string;
  eventType: string;
  severityFilter: string | null;
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: string;
}

const severityColors: Record<string, string> = {
  info: 'bg-signal/10 text-signal',
  warning: 'bg-yellow-500/10 text-yellow-400',
  critical: 'bg-red-500/10 text-red-400',
};

const statusColors: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  acknowledged: 'bg-yellow-500/10 text-yellow-400',
  resolved: 'bg-green-500/10 text-green-400',
};

export default async function AlertsPage() {
  let alerts: Alert[] = [];
  let alertRules: AlertRule[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        const [alertsData, rulesData] = await Promise.all([
          apiClient<{ alerts: Alert[] }>(
            `/api/security/instances/${instance.id}/alerts`, { token },
          ),
          apiClient<{ alertRules: AlertRule[] }>(
            `/api/security/instances/${instance.id}/alert-rules`, { token },
          ),
        ]);
        alerts = alertsData.alerts;
        alertRules = rulesData.alertRules;
      }
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Security Alerts</h1>
        <p className="text-sm text-text-secondary mt-1">Monitor triggered alerts and manage alert rules</p>
      </div>

      {/* Triggered Alerts */}
      <div className="mb-8 rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-text-secondary" />
          Triggered Alerts
        </h3>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
              <Bell className="h-6 w-6 text-text-secondary" />
            </div>
            <h3 className="text-base font-semibold mb-1">No alerts</h3>
            <p className="text-sm text-text-secondary max-w-sm">No security alerts have been triggered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 font-medium">Severity</th>
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Triggered</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[alert.severity] ?? 'bg-surface text-text-primary'}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-neutral-200">{alert.title}</td>
                    <td className="py-3 text-text-secondary">{alert.triggeredCount}x</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[alert.status] ?? 'bg-surface text-text-primary'}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="py-3 text-text-dim whitespace-nowrap">{formatDate(alert.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alert Rules */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-text-secondary" />
          Alert Rules
        </h3>
        {alertRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
              <ShieldAlert className="h-6 w-6 text-text-secondary" />
            </div>
            <h3 className="text-base font-semibold mb-1">No alert rules</h3>
            <p className="text-sm text-text-secondary max-w-sm">Create alert rules to get notified about security events.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Event Type</th>
                  <th className="pb-3 font-medium">Threshold</th>
                  <th className="pb-3 font-medium">Window</th>
                  <th className="pb-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {alertRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-3 font-medium text-neutral-200">{rule.name}</td>
                    <td className="py-3 font-mono text-xs text-text-secondary">{rule.eventType}</td>
                    <td className="py-3 text-text-secondary">{rule.threshold}</td>
                    <td className="py-3 text-text-secondary">{rule.windowMinutes}m</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${rule.isActive ? 'bg-green-500/10 text-green-400' : 'bg-surface text-text-dim'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
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
