'use client';

import { Activity, AlertTriangle, Bot, Gauge } from 'lucide-react';
import { type ActivitySummary, riskBgColor, scoreColor, type RiskLevel } from './types';

interface SummaryCardsProps {
  summary: ActivitySummary;
}

const RISK_LEVELS: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Total Events',
      value: summary.totalEvents,
      color: 'text-info',
      icon: Activity,
    },
    {
      label: 'Critical Events',
      value: summary.criticalEvents,
      color: summary.criticalEvents > 0 ? 'text-red-500' : 'text-neutral-400',
      icon: AlertTriangle,
    },
    {
      label: 'Agents Monitored',
      value: summary.agentsMonitored,
      color: 'text-green-400',
      icon: Bot,
    },
    {
      label: 'Risk Score',
      value: summary.riskScore,
      color: scoreColor(summary.riskScore),
      icon: Gauge,
    },
  ];

  const total = Object.values(summary.riskBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">{label}</span>
              <Icon className="h-4 w-4 text-neutral-600" />
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
          <p className="text-xs text-neutral-400 mb-3">Risk Distribution</p>
          <div className="flex h-3 overflow-hidden rounded-full">
            {RISK_LEVELS.map((level) => {
              const count = summary.riskBreakdown[level];
              if (count === 0) return null;
              const pct = (count / total) * 100;
              return (
                <div
                  key={level}
                  className={`${riskBgColor(level)} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${level}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-neutral-500">
            {RISK_LEVELS.map((level) => (
              <span key={level} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${riskBgColor(level)}`} />
                {level}: {summary.riskBreakdown[level]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
