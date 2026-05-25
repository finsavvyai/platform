'use client';

import { ATTACK_COLORS, type HourlyAttacks } from './types';

interface Props {
  data: HourlyAttacks[];
}

export function AttackTimeline({ data }: Props): React.ReactElement {
  const maxTotal = Math.max(
    ...data.map((d) => d.injection + d.bruteForce + d.rateAbuse + d.authBypass),
    1
  );
  const svgWidth = 720;
  const svgHeight = 200;
  const barWidth = svgWidth / data.length - 2;
  const padding = 30;
  const chartHeight = svgHeight - padding;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Attack Timeline (24h)</h2>
        <div className="flex gap-4">
          {Object.entries(ATTACK_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-neutral-400">{type}</span>
            </div>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
        {data.map((d, i) => {
          const x = i * (svgWidth / data.length) + 1;
          const scale = (chartHeight * 0.9) / maxTotal;

          let y = chartHeight;
          const segments = [
            { value: d.injection, color: ATTACK_COLORS.Injection },
            { value: d.bruteForce, color: ATTACK_COLORS['Brute Force'] },
            { value: d.rateAbuse, color: ATTACK_COLORS['Rate Abuse'] },
            { value: d.authBypass, color: ATTACK_COLORS['Auth Bypass'] },
          ];

          return (
            <g key={d.hour}>
              {segments.map((seg, si) => {
                const h = seg.value * scale;
                y -= h;
                return (
                  <rect
                    key={si}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill={seg.color}
                    opacity={0.8}
                    rx={1}
                  />
                );
              })}
              {i % 3 === 0 && (
                <text x={x + barWidth / 2} y={svgHeight - 2} textAnchor="middle" className="fill-neutral-500 text-[10px]">
                  {`${d.hour}:00`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
