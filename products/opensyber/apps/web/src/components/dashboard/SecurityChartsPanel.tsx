'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { TrendingUp, PieChart, BarChart3, Shield } from 'lucide-react';
import {
  ThreatTrendChart,
  SeverityDonutChart,
  SecurityScoreChart,
  AlertVolumeChart,
} from '@opensyber/ui';
import type {
  ThreatTrendPoint,
  SeverityData,
  ScoreHistoryPoint,
  AlertVolumePoint,
} from '@opensyber/ui';

interface Props {
  instanceId: string;
}

interface ChartsData {
  threatTrend: ThreatTrendPoint[];
  severities: SeverityData[];
  scoreHistory: ScoreHistoryPoint[];
  alertVolume: AlertVolumePoint[];
}

export function SecurityChartsPanel({ instanceId }: Props) {
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/proxy/security/instances/${instanceId}/charts`);
        if (res.ok) {
          const json = (await res.json()) as { data?: Partial<ChartsData> | null };
          setData({
            threatTrend: json.data?.threatTrend ?? [],
            severities: json.data?.severities ?? [],
            scoreHistory: json.data?.scoreHistory ?? [],
            alertVolume: json.data?.alertVolume ?? [],
          });
        }
      } catch (err) {
        // Keep console.warn as a fallback for tests and local dev; Sentry only
        // reports when NEXT_PUBLIC_SENTRY_DSN is set (see sentry.client.config.ts).
        console.warn('[SecurityCharts] Failed to load chart data:', err);
        Sentry.captureException(err, {
          tags: { component: 'SecurityChartsPanel' },
          extra: { instanceId },
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [instanceId]);

  if (loading) {
    return (
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded border border-border bg-panel/30 p-6">
            <div className="h-[220px] bg-surface/50 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mb-8 rounded border border-border bg-panel/30 p-6 text-center">
        <Shield className="h-6 w-6 text-text-dim mx-auto mb-2" />
        <p className="text-sm text-text-dim">
          Security charts will appear after your instance collects monitoring data.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2">
      <ChartCard icon={TrendingUp} title="Risk Trend">
        <ThreatTrendChart data={data.threatTrend} />
      </ChartCard>
      <ChartCard icon={PieChart} title="Severity Distribution">
        <SeverityDonutChart data={data.severities} />
      </ChartCard>
      <ChartCard icon={Shield} title="Security Score">
        <SecurityScoreChart data={data.scoreHistory} />
      </ChartCard>
      <ChartCard icon={BarChart3} title="Alert Volume">
        <AlertVolumeChart data={data.alertVolume} />
      </ChartCard>
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
