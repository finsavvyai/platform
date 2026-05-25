'use client';

import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';

interface TrustScoreIndicatorProps {
  score: number | null;
  bound: boolean;
}

export function TrustScoreIndicator({ score, bound }: TrustScoreIndicatorProps) {
  if (!bound || score === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-surface/50 px-3 py-1.5">
        <ShieldOff className="h-4 w-4 text-text-dim" />
        <span className="text-xs text-text-dim">Unbound</span>
      </div>
    );
  }

  const color = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  const bgColor = score >= 80 ? 'bg-green-500/10' : score >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10';
  const Icon = score >= 80 ? ShieldCheck : ShieldAlert;

  return (
    <div className={`flex items-center gap-2 rounded-lg ${bgColor} px-3 py-1.5`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${color}`}>{score}</span>
        <span className="text-[10px] text-text-dim">Trust</span>
      </div>
    </div>
  );
}
