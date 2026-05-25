'use client';

import { Globe, AlertTriangle, Bot, Shield } from 'lucide-react';
import type { SaasApp } from './types';

interface Props {
  apps: SaasApp[];
}

export function StatsRow({ apps }: Props): React.ReactElement {
  const total = apps.length;
  const highRiskOAuth = apps.filter(
    (a) => a.riskLevel === 'Critical' || a.riskLevel === 'High'
  ).length;
  const shadowAI = apps.filter((a) => a.isShadowAI).length;
  const exposureScore = Math.min(
    100,
    Math.round((highRiskOAuth * 15 + shadowAI * 10) * (total / 10))
  );

  const cards = [
    {
      label: 'Total SaaS Apps Detected',
      value: total,
      icon: Globe,
      color: 'text-info',
    },
    {
      label: 'High-Risk OAuth Apps',
      value: highRiskOAuth,
      icon: AlertTriangle,
      color: 'text-red-400',
    },
    {
      label: 'Shadow AI Tools',
      value: shadowAI,
      icon: Bot,
      color: 'text-amber-400',
    },
    {
      label: 'Data Exposure Score',
      value: exposureScore,
      icon: Shield,
      color: exposureScore > 60 ? 'text-red-400' : 'text-green-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">{c.label}</p>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
