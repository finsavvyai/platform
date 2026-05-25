'use client';

import { useMemo } from 'react';
import type { SessionStats } from './types';

interface SessionTypeChartProps {
  stats: SessionStats;
}

const segments = [
  { key: 'ssh' as const, label: 'SSH', color: '#3b82f6' },
  { key: 'web' as const, label: 'Web', color: '#22c55e' },
  { key: 'api' as const, label: 'API', color: '#f59e0b' },
];

export function SessionTypeChart({ stats }: SessionTypeChartProps): React.ReactElement {
  const total = stats.byType.ssh + stats.byType.web + stats.byType.api;

  const chartSegments = useMemo(() => {
    const result: Array<typeof segments[number] & { dashArray: string; dashOffset: string }> = [];
    let cumulative = 0;  
    for (const seg of segments) {
      const pct = (stats.byType[seg.key] / total) * 100;
      result.push({ ...seg, dashArray: `${pct} ${100 - pct}`, dashOffset: String(100 - cumulative + 25) });
      cumulative += pct;
    }
    return result;
  }, [stats.byType, total]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 mb-8">
      <h3 className="text-lg font-medium mb-4">Sessions by Type</h3>
      <div className="flex items-center gap-8">
        <svg viewBox="0 0 36 36" className="h-32 w-32 shrink-0">
          {chartSegments.map((seg) => (
              <circle
                key={seg.key}
                cx="18" cy="18" r="15.915"
                fill="none"
                stroke={seg.color}
                strokeWidth="3.5"
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                className="transition-all"
              />
            ))}
        </svg>
        <div className="flex flex-col gap-3">
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-sm text-neutral-300">{seg.label}</span>
              <span className="text-sm font-medium text-neutral-100">{stats.byType[seg.key]}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
