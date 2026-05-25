'use client';

import type { CorrelatedEvent } from './types';
import { SOURCE_COLORS } from './types';

interface CorrelationVizProps {
  events: CorrelatedEvent[];
}

export function CorrelationViz({ events }: CorrelationVizProps): React.ReactElement {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const w = 600;
  const h = 120;
  const padX = 20;
  const padY = 20;
  const chartW = w - padX * 2;

  const minT = new Date(sorted[0].timestamp).getTime();
  const maxT = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const range = Math.max(maxT - minT, 1);

  function x(ts: string): number {
    return padX + ((new Date(ts).getTime() - minT) / range) * chartW;
  }

  // Vertical grouping by source
  const sources = [...new Set(sorted.map((e) => e.source))];
  function y(source: string): number {
    const idx = sources.indexOf(source);
    return padY + (idx / Math.max(sources.length - 1, 1)) * (h - padY * 2);
  }

  // Draw correlation lines between consecutive events
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    lines.push({
      x1: x(sorted[i].timestamp),
      y1: y(sorted[i].source),
      x2: x(sorted[i + 1].timestamp),
      y2: y(sorted[i + 1].source),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400 font-medium">Event Correlation</p>
      <div className="overflow-x-auto">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[400px]">
          {/* Timeline axis */}
          <line x1={padX} y1={h - 5} x2={w - padX} y2={h - 5} stroke="#262626" strokeWidth={1} />

          {/* Correlation lines */}
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#404040" strokeWidth={1} strokeDasharray="3,3"
            />
          ))}

          {/* Event dots */}
          {sorted.map((ev) => (
            <g key={ev.id}>
              <circle
                cx={x(ev.timestamp)}
                cy={y(ev.source)}
                r={6}
                fill={SOURCE_COLORS[ev.source] || '#6b7280'}
                stroke="#1a1a1a"
                strokeWidth={1.5}
              />
              <title>{`${ev.source}: ${ev.detail}`}</title>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {sources.map((source) => (
          <div key={source} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: SOURCE_COLORS[source] || '#6b7280' }}
            />
            <span className="text-[10px] text-neutral-500">{source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
