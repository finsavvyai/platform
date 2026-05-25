'use client';

import { BarChart3, TrendingUp, Users, Package } from 'lucide-react';
import {
  PlanDistributionChart,
  RevenueTrendChart,
  ConversionFunnelChart,
  SkillPopularityChart,
} from '@opensyber/ui';
import type {
  PlanDistributionData,
  RevenuePoint,
  ConversionStep,
  SkillPopularityData,
} from '@opensyber/ui';

interface Props {
  planBreakdown: Record<string, number>;
  revenueTrend?: RevenuePoint[];
  conversionSteps?: ConversionStep[];
  skillPopularity?: SkillPopularityData[];
}

export function AdminChartsPanel({
  planBreakdown,
  revenueTrend,
  conversionSteps,
  skillPopularity,
}: Props) {
  const planData: PlanDistributionData[] = Object.entries(planBreakdown).map(
    ([plan, count]) => ({ plan, count }),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard icon={Users} title="Plan Distribution">
        <PlanDistributionChart data={planData} />
      </ChartCard>

      {revenueTrend && revenueTrend.length >= 2 && (
        <ChartCard icon={TrendingUp} title="Revenue Trend">
          <RevenueTrendChart data={revenueTrend} />
        </ChartCard>
      )}

      {conversionSteps && conversionSteps.length > 0 && (
        <ChartCard icon={BarChart3} title="Conversion Funnel">
          <ConversionFunnelChart data={conversionSteps} />
        </ChartCard>
      )}

      {skillPopularity && skillPopularity.length > 0 && (
        <ChartCard icon={Package} title="Top Skills">
          <SkillPopularityChart data={skillPopularity} />
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">
          {title}
        </span>
      </h3>
      {children}
    </div>
  );
}
