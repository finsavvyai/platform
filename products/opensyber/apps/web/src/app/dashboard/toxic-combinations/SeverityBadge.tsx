'use client';

import type { Severity } from './types';

const BADGE_STYLES: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-info/20 text-info border-info/30',
};

interface Props {
  severity: Severity;
  small?: boolean;
}

export function SeverityBadge({ severity, small }: Props) {
  const base = BADGE_STYLES[severity];
  const size = small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span className={`inline-flex items-center rounded-md border font-medium uppercase ${base} ${size}`}>
      {severity}
    </span>
  );
}
