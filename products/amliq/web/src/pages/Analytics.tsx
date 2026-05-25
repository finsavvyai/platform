import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { AreaChartComponent } from '../components/charts/AreaChart';
import { DonutChart } from '../components/charts/DonutChart';
import { BarChartComponent } from '../components/charts/BarChart';
import { useAnalytics } from '../hooks/useAnalytics';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ScreeningHeatmap } from '../components/analytics/ScreeningHeatmap';

export function Analytics() {
  const { t } = useTranslation('analytics');
  const { analytics, loading, error } = useAnalytics();

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  }

  if (error) {
    return <p className="text-apple-red sf-caption" role="alert">{error.message}</p>;
  }

  if (!analytics) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        <div className="glass-panel rounded-apple-lg p-xxl text-center">
          <p className="sf-body mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>No screening data yet</p>
          <p className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
            Run your first screening to see analytics here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="glass-panel rounded-apple-lg p-md">
          <AreaChartComponent title={t('charts.screening_volume')} data={analytics.screeningVolume} />
        </div>
        <div className="glass-panel rounded-apple-lg p-md">
          <DonutChart title={t('charts.alert_disposition')} data={analytics.dispositionBreakdown} />
        </div>
      </div>
      <div className="glass-panel rounded-apple-lg p-md">
        <BarChartComponent title={t('charts.risk_distribution')} data={analytics.riskDistribution} />
      </div>
      <ScreeningHeatmap />
    </div>
  );
}
