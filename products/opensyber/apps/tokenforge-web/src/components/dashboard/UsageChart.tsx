'use client';

import { useState, useCallback } from 'react';
import { useApi } from '@/lib/use-api';
import { fetchUsageDaily } from '@/lib/tokenforge-api';
import type { UsageDataPoint } from './types';

export function UsageChart(): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchUsageDaily(token, signal),
    [],
  );
  const { data, loading } = useApi<UsageDataPoint[]>(fetcher);

  if (loading || !data) {
    return (
      <div className="flex items-end gap-3" style={{ height: 160 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-end justify-center">
            <div className="w-full max-w-10 animate-pulse rounded-t bg-neutral-800" style={{ height: 40 + i * 12 }} />
          </div>
        ))}
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-3" style={{ height: 160 }}>
      {data.map((point, i) => {
        const heightPercent = (point.count / maxCount) * 100;
        const isHovered = hoveredIndex === i;

        return (
          <div
            key={point.day}
            className="relative flex flex-1 flex-col items-center"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {isHovered && (
              <div className="absolute -top-8 rounded bg-neutral-800 px-2 py-1 text-xs font-medium text-white shadow-lg">
                {point.count.toLocaleString()}
              </div>
            )}
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-10 rounded-t transition-all ${
                  isHovered ? 'bg-info' : 'bg-info/70'
                }`}
                style={{ height: `${heightPercent}%`, minHeight: 4 }}
              />
            </div>
            <span className="mt-2 text-xs text-neutral-500">{point.day}</span>
          </div>
        );
      })}
    </div>
  );
}
