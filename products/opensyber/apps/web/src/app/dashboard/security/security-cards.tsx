import Link from 'next/link';
import { Bell, AlertOctagon, Bug, ExternalLink, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { SecurityDashboard } from './security-helpers';
import { categoryLabels, severityColors, scoreColor, barColor } from './security-helpers';

export function TopStatsRow({ dashboard, instanceId, vs }: {
  dashboard: SecurityDashboard; instanceId: string | null;
  vs: { critical: number; high: number; medium: number; low: number };
}) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-4">
      <div className="rounded border border-border bg-panel/30 p-6 text-center">
        <p className="text-sm text-text-secondary mb-2">Overall Score</p>
        <p className={`text-5xl font-bold ${scoreColor(dashboard.score.overall)}`}>{dashboard.score.overall}</p>
        <p className="text-xs text-text-dim mt-2">out of 100</p>
        {instanceId && (
          <Link href={`/score/${instanceId}`} target="_blank"
            className="mt-2 inline-flex items-center gap-1 text-xs text-signal hover:text-signal-hover transition">
            <ExternalLink className="h-3 w-3" />Share Scorecard
          </Link>
        )}
      </div>
      <Link href="/dashboard/security/alerts" className="rounded border border-border bg-panel/30 p-6 hover:border-wire transition">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-2"><Bell className="h-4 w-4" />Open Alerts</div>
        <p className={`text-3xl font-bold ${dashboard.openAlerts > 0 ? 'text-red-400' : 'text-green-400'}`}>{dashboard.openAlerts}</p>
      </Link>
      <Link href="/dashboard/security/incidents" className="rounded border border-border bg-panel/30 p-6 hover:border-wire transition">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-2"><AlertOctagon className="h-4 w-4" />Open Incidents</div>
        <p className={`text-3xl font-bold ${dashboard.openIncidents > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{dashboard.openIncidents}</p>
      </Link>
      <Link href="/dashboard/security/vulnerabilities" className="rounded border border-border bg-panel/30 p-6 hover:border-wire transition">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-2"><Bug className="h-4 w-4" />Vulnerabilities</div>
        <div className="flex gap-2 text-xs mt-1">
          {vs.critical > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-400">{vs.critical} Critical</span>}
          {vs.high > 0 && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-400">{vs.high} High</span>}
          {vs.medium > 0 && <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-400">{vs.medium} Med</span>}
          {vs.critical === 0 && vs.high === 0 && vs.medium === 0 && <span className="text-green-400 text-sm font-medium">Clean</span>}
        </div>
      </Link>
    </div>
  );
}

export function SkillsCard({ dashboard }: { dashboard: SecurityDashboard }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <p className="text-sm text-text-secondary mb-3">Installed Skills</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Verified</span>
          <span className="font-medium">{dashboard.installedSkills.verified}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-400" />Unverified</span>
          <span className="font-medium">{dashboard.installedSkills.unverified}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-400" />Blocked</span>
          <span className="font-medium">{dashboard.installedSkills.blocked}</span>
        </div>
      </div>
    </div>
  );
}

export function LastHealthCard({ dashboard }: { dashboard: SecurityDashboard }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <p className="text-sm text-text-secondary mb-3">Last Health Check</p>
      <p className="text-sm font-medium">{dashboard.lastScan ? formatDate(dashboard.lastScan) : 'Never'}</p>
      {dashboard.score.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-dim">{dashboard.score.recommendations.length} recommendation(s)</p>
        </div>
      )}
    </div>
  );
}

export function CategoryBreakdown({ dashboard }: { dashboard: SecurityDashboard }) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
      <div className="space-y-4">
        {Object.entries(dashboard.score.categories).map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-text-primary">{categoryLabels[key] ?? key}</span>
              <span className={`font-medium ${scoreColor(value)}`}>{value}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div className={`h-full rounded-full ${barColor(value)} transition-all`} style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentEventsTable({ dashboard }: { dashboard: SecurityDashboard }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Security Events</h3>
      {dashboard.recentEvents.length === 0 ? (
        <p className="text-sm text-text-dim">No security events recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Details</th>
                <th className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {dashboard.recentEvents.map((event) => (
                <tr key={event.id}>
                  <td className="py-3 font-mono text-xs">{event.eventType}</td>
                  <td className="py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[event.severity] ?? 'bg-surface text-text-primary'}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="py-3 text-text-secondary max-w-xs truncate">{event.details || '\u2014'}</td>
                  <td className="py-3 text-text-dim whitespace-nowrap">{formatDate(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
