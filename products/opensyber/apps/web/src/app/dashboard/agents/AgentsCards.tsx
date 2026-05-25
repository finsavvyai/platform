'use client';

import { AlertTriangle, Eye, Terminal, Key } from 'lucide-react';
import type { Summary } from './agents-helpers';
import { RISK_COLORS, scoreColor, scoreLabel } from './agents-helpers';

export function ScoreCard({ score, summary }: { score: number; summary: Summary }) {
  return (
    <div className="mb-8 rounded border border-border bg-panel/50 p-6 flex items-center gap-8">
      <div className={`text-5xl font-bold ${scoreColor(score)}`}>{score}</div>
      <div>
        <p className={`text-xl font-semibold ${scoreColor(score)}`}>{scoreLabel(score)}</p>
        <p className="text-sm text-text-secondary mt-1">
          {summary.critical > 0
            ? `${summary.critical} critical event${summary.critical > 1 ? 's' : ''} -- secrets or credentials accessed`
            : summary.high > 0
              ? `${summary.high} high-risk operation${summary.high > 1 ? 's' : ''} detected`
              : 'No critical or high-risk events in logged history'}
        </p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-xs text-text-dim uppercase tracking-wider">Risk Score</p>
        <p className="text-sm text-text-secondary">{summary.total} events total</p>
      </div>
    </div>
  );
}

export function StatGrid({ summary }: { summary: Summary }) {
  const severities = [
    { label: 'Critical', value: summary.critical, color: 'text-red-400', icon: AlertTriangle },
    { label: 'High', value: summary.high, color: 'text-orange-400', icon: AlertTriangle },
    { label: 'Medium', value: summary.medium, color: 'text-amber-400', icon: Eye },
    { label: 'Low', value: summary.low, color: 'text-text-dim', icon: Eye },
  ];
  const findings = [
    { label: 'Secrets', value: summary.secretsDetected, color: 'text-red-400', icon: Key },
    { label: 'Total', value: summary.total, color: 'text-signal', icon: Terminal },
  ];
  return (
    <div className="mb-8 space-y-3">
      <p className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-text-dim">Severity</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {severities.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded border border-border bg-panel/30 p-5">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-dim">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-text-dim pt-2">Findings</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        {findings.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded border border-border bg-panel/30 p-5">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-dim">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskDistribution({ summary }: { summary: Summary }) {
  const risks = ['critical', 'high', 'medium', 'low'] as const;
  const barColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-neutral-600',
  };

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-dim">
        Risk Distribution
      </h2>
      <div className="space-y-3">
        {risks.map((risk) => {
          const count = summary[risk];
          const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
          return (
            <div key={risk} className="flex items-center gap-4">
              <span className={`w-16 text-xs font-semibold uppercase ${RISK_COLORS[risk]}`}>{risk}</span>
              <div
                className="flex-1 rounded-full bg-surface h-2"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${risk}: ${pct}%`}
              >
                <div
                  className={`h-2 rounded-full ${barColors[risk]} transition-all duration-300 ease-out`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-text-dim">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
