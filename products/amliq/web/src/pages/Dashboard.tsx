import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/data/StatCard';
import { AreaChartComponent } from '../components/charts/AreaChart';
import { DonutChart } from '../components/charts/DonutChart';
import { BarChartComponent } from '../components/charts/BarChart';
import { useAnalytics } from '../hooks/useAnalytics';
import { ComplianceMetrics } from '../components/data/ComplianceMetrics';
import { DashboardGreeting } from '../components/dashboard/DashboardGreeting';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState';
import { TopEntitiesTable } from '../components/dashboard/TopEntitiesTable';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { QuickActions } from '../components/dashboard/QuickActions';
import { KPIProgressRing } from '../components/dashboard/KPIProgressRing';
import { ComplianceStreak } from '../components/dashboard/ComplianceStreak';

const MOCK_STREAK = 12;

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const { analytics, loading } = useAnalytics();

  if (loading) return <DashboardSkeleton />;

  const d = {
    totalAlerts: analytics?.totalAlerts ?? 0,
    clearedAlerts: analytics?.clearedAlerts ?? 0,
    escalatedAlerts: analytics?.escalatedAlerts ?? 0,
    avgResolutionTime: analytics?.avgResolutionTime ?? 0,
    screeningVolume: analytics?.screeningVolume ?? [],
    dispositionBreakdown: analytics?.dispositionBreakdown ?? [],
    riskDistribution: analytics?.riskDistribution ?? [],
    topEntities: analytics?.topEntities ?? [],
  };

  const hasData = d.totalAlerts > 0 || d.screeningVolume.length > 0;

  return (
    <div className="space-y-6">
      <DashboardGreeting />
      <QuickActions />

      {!hasData && <DashboardEmptyState />}

      {hasData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t('total_alerts')} value={d.totalAlerts} trend={12} color="blue" />
            <StatCard title={t('cleared_today')} value={d.clearedAlerts} trend={8} color="green" />
            <StatCard title={t('escalated')} value={d.escalatedAlerts} trend={-3} color="red" />
            <StatCard title={t('avg_resolution')} value={`${d.avgResolutionTime}h`}
              description={t('time_in_hours')} color="orange" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <AreaChartComponent title={t('screening_volume')} data={d.screeningVolume} />
              <DonutChart title={t('disposition_breakdown')} data={d.dispositionBreakdown} />
            </div>
            <ActivityFeed />
          </div>

          <div className="boutique-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] mb-5"
              style={{ color: 'var(--dash-text-tertiary)' }}>
              KPI Progress
            </p>
            <div className="flex flex-wrap items-start gap-8 justify-around">
              <KPIProgressRing label="Screenings" value={d.totalAlerts} target={100} unit="/day" />
              <KPIProgressRing label="SLA Compliance" value={d.clearedAlerts} target={95} unit="%" color="#2D7A4F" />
              <KPIProgressRing label="Escalations Resolved" value={Math.max(0, 10 - d.escalatedAlerts)} target={10} unit="" color="#B7791F" />
            </div>
          </div>

          <ComplianceStreak streakDays={MOCK_STREAK} />

          <ComplianceMetrics />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartComponent title={t('risk_distribution')} data={d.riskDistribution} />
            <TopEntitiesTable entities={d.topEntities} />
          </div>
        </>
      )}
    </div>
  );
}
