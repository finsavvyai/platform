'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Monitor, ShieldCheck, Activity, Gauge, ShieldOff } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { fetchDashboardStats, fetchSessions, fetchEvents } from '@/lib/tokenforge-api';
import { UsageChart } from '@/components/dashboard/UsageChart';
import { RecentSessionsList } from '@/components/dashboard/RecentSessionsList';
import { UpgradeBanner } from '@/components/dashboard/UpgradeBanner';
import type { DashboardStats, Session, SecurityEvent } from '@/components/dashboard/types';
import { EmptyState } from './DashboardEmptyState';

function trustScoreColor(score: number): string {
  if (score >= 80) return 'text-ok';
  if (score >= 50) return 'text-warn';
  return 'text-alert';
}

export default function DashboardOverviewPage(): React.ReactElement {
  const statsFetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchDashboardStats(token, signal),
    [],
  );
  const sessionsFetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchSessions(token, signal),
    [],
  );
  const eventsFetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchEvents(token, signal),
    [],
  );

  const { data: stats, loading: statsLoading } = useApi<DashboardStats>(statsFetcher);
  const { data: sessions, loading: sessionsLoading } = useApi<Session[]>(sessionsFetcher);
  const { data: events } = useApi<SecurityEvent[]>(eventsFetcher);

  const recentSessions = sessions?.slice(0, 5) ?? [];
  const threatsBlocked = events?.filter((e) =>
    ['session.hijack_attempt', 'trust_score.critical'].includes(e.type),
  ).length ?? 0;

  const hasData = stats && (stats.activeSessions > 0 || stats.verificationsToday > 0);

  if (!statsLoading && !hasData) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Monitor your session security at a glance
          </p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const statCards = stats ? [
    {
      label: 'Active Sessions',
      value: stats.activeSessions.toLocaleString(),
      icon: Monitor,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'Verifications Today',
      value: stats.verificationsToday.toLocaleString(),
      icon: ShieldCheck,
      color: 'text-ok',
      bgColor: 'bg-ok/10',
    },
    {
      label: 'Threats Blocked',
      value: String(threatsBlocked),
      icon: ShieldOff,
      color: threatsBlocked > 0 ? 'text-alert' : 'text-text-dim',
      bgColor: threatsBlocked > 0 ? 'bg-alert/10' : 'bg-surface',
    },
    {
      label: 'Trust Score Avg',
      value: String(stats.trustScoreAverage),
      icon: Gauge,
      color: trustScoreColor(stats.trustScoreAverage),
      bgColor: 'bg-warn/10',
    },
  ] : [];

  return (
    <div>
      <UpgradeBanner
        plan="free"
        usage={stats?.planUsed}
        limit={stats?.planLimit}
      />

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Monitor your session security at a glance
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/50 bg-panel" />
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-border/50 bg-panel p-6">
                  <div className="mb-3 flex items-center gap-2 text-sm text-text-secondary">
                    <div className={`rounded-lg p-1.5 ${card.bgColor}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    {card.label}
                  </div>
                  <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                </div>
              );
            })}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-panel p-6">
          <h2 className="mb-4 text-lg font-semibold">Verifications (Last 7 Days)</h2>
          <UsageChart />
        </div>
        {stats && (
          <div className="rounded-2xl border border-border/50 bg-panel p-6">
            <h2 className="mb-4 text-lg font-semibold">Plan Usage</h2>
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary">Verifications</span>
                <span>{stats.planUsagePercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface">
                <div
                  className={`h-2 rounded-full transition-all ${
                    stats.planUsagePercent > 80 ? 'bg-alert' : 'bg-info'
                  }`}
                  style={{ width: `${Math.min(100, stats.planUsagePercent)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {(stats.planUsed / 1000).toFixed(0)}K / {(stats.planLimit / 1000).toFixed(0)}K
              </p>
            </div>
            <Link href="/pricing" className="text-xs text-info hover:text-signal-hover">
              Upgrade plan &rarr;
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
          <Link href="/dashboard/sessions" className="text-xs text-info hover:text-signal-hover">
            View all &rarr;
          </Link>
        </div>
        {sessionsLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-surface/30" />
        ) : (
          <RecentSessionsList sessions={recentSessions} />
        )}
      </div>
    </div>
  );
}
