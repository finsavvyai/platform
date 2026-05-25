'use client';

import type { IdentityType } from './types';

const typeStyles: Record<IdentityType, string> = {
  human: 'bg-info/10 text-info',
  service: 'bg-purple-500/10 text-purple-400',
  bot: 'bg-amber-500/10 text-amber-400',
  automation: 'bg-green-500/10 text-green-400',
};

const typeLabels: Record<IdentityType, string> = {
  human: 'Human',
  service: 'Service Account',
  bot: 'Bot',
  automation: 'Automation',
};

export function IdentityTypeBadge({ type }: { type: IdentityType }): React.ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyles[type]}`}>
      {typeLabels[type]}
    </span>
  );
}

export function RiskBadge({ score }: { score: number }): React.ReactElement {
  const color =
    score >= 70 ? 'text-red-400 bg-red-500/10' :
    score >= 40 ? 'text-amber-400 bg-amber-500/10' :
    'text-green-400 bg-green-500/10';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{score}</span>;
}
