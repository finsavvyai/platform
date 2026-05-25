'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import type { ExecutiveDashboardData } from './types';
import { ScoreRing } from './ScoreRing';
import { KpiCards } from './KpiCards';
import { ScoreTrendChart, RiskTrendChart } from './TrendCharts';
import { Leaderboard } from './Leaderboard';
import { ComplianceGrid } from './ComplianceGrid';
import { MilestoneTimeline } from './MilestoneTimeline';
import { fetchExecutiveData } from './fetch-executive';

export function ExecutiveClient({ data: initialData }: { data?: ExecutiveDashboardData }) {
  const [data, setData] = useState<ExecutiveDashboardData | null>(initialData ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExecutiveData()
      .then((real) => { if (real) setData(real); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading executive data...
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Board-ready security program overview
        </p>
      </div>

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <BarChart3 className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Executive Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing executive security metrics. Data will appear here automatically.
          </p>
        </div>
      )}

      {data && (
        <>
          <ScoreRing
            score={data.securityScore}
            grade={data.grade}
            delta={data.securityScoreDelta}
            riskLevel={data.riskLevel}
          />

          <KpiCards kpis={data.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScoreTrendChart data={data.scoreTrend} />
            <RiskTrendChart data={data.riskDistribution} />
          </div>

          <Leaderboard members={data.leaderboard} />

          <ComplianceGrid frameworks={data.compliance} />

          <MilestoneTimeline milestones={data.milestones} />
        </>
      )}
    </div>
  );
}
