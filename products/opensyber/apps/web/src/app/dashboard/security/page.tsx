import { Shield, AlertTriangle } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { ScoreHistoryChart } from '@/components/dashboard/security/ScoreHistoryChart';
import { ThreatMapViz } from '@/components/dashboard/security/ThreatMapViz';
import type { SecurityDashboard, ScorePoint, ThreatCountry } from './security-helpers';
import { TopStatsRow, SkillsCard, LastHealthCard, CategoryBreakdown, RecentEventsTable } from './security-cards';

export const metadata = { title: 'Security Dashboard' };

export default async function SecurityPage() {
  let dashboard: SecurityDashboard | null = null;
  let scoreHistory: ScorePoint[] = [];
  let threatCountries: ThreatCountry[] = [];
  let instanceId: string | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const [dashData, scoreData, threatData] = await Promise.allSettled([
          apiClient<{ dashboard: SecurityDashboard }>(`/api/security/instances/${instance.id}/dashboard`, { token }),
          apiClient<{ history: ScorePoint[] }>(`/api/security/instances/${instance.id}/score-history?period=30d`, { token }),
          apiClient<{ threatMap: { entries: Array<{ country: string; count: number; severity: string }> } }>(`/api/security/instances/${instance.id}/threat-map`, { token }),
        ]);
        if (dashData.status === 'fulfilled') dashboard = dashData.value.dashboard;
        if (scoreData.status === 'fulfilled') scoreHistory = scoreData.value.history;
        if (threatData.status === 'fulfilled') {
          const entries = threatData.value.threatMap?.entries ?? [];
          threatCountries = entries.map((e) => ({
            country: e.country,
            eventCount: e.count,
            severity: (e.severity as ThreatCountry['severity']) ?? 'low',
          }));
        }
      }
    }
  } catch (err) { console.error('[Security] Failed to fetch security dashboard:', err instanceof Error ? err.message : err); }

  if (!dashboard) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Security</h1>
        <p className="text-sm text-text-secondary mb-8">Security dashboard for your AI agent instance</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Shield className="h-6 w-6 text-text-secondary" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold mb-1">No security data</h3>
          <p className="text-sm text-text-secondary max-w-sm">Deploy an instance to see security metrics and events.</p>
        </div>
      </div>
    );
  }

  const vs = dashboard.vulnerabilitySummary ?? { critical: 0, high: 0, medium: 0, low: 0 };
  const recommendations = dashboard.score?.recommendations ?? [];
  const recentEvents = dashboard.recentEvents ?? [];
  const safeDb: SecurityDashboard = {
    ...dashboard,
    score: {
      overall: dashboard.score?.overall ?? 0,
      categories: dashboard.score?.categories ?? {},
      recommendations,
    },
    recentEvents,
    installedSkills: dashboard.installedSkills ?? { verified: 0, unverified: 0, blocked: 0 },
    openAlerts: dashboard.openAlerts ?? 0,
    openIncidents: dashboard.openIncidents ?? 0,
    vulnerabilitySummary: vs,
    lastScan: dashboard.lastScan ?? null,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="text-sm text-text-secondary mt-1">Security dashboard for your AI agent instance</p>
      </div>

      <TopStatsRow dashboard={safeDb} instanceId={instanceId} vs={vs} />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <SkillsCard dashboard={safeDb} />
        <LastHealthCard dashboard={safeDb} />
      </div>

      <CategoryBreakdown dashboard={safeDb} />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <ScoreHistoryChart data={scoreHistory} />
        <ThreatMapViz countries={threatCountries} />
      </div>

      {recommendations.length > 0 && (
        <div className="mb-8 rounded border border-yellow-500/20 bg-yellow-500/5 p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />Recommendations
          </h3>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-text-primary flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">&#8226;</span>{rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <RecentEventsTable dashboard={safeDb} />
    </div>
  );
}

