'use client';

import type { CveDataPoint } from './types';

interface Props {
  data: CveDataPoint[];
}

const CHART_W = 720;
const CHART_H = 200;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

export function CveTimeline({ data }: Props): React.ReactElement {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  function x(i: number): number {
    return PAD_L + (i / (data.length - 1)) * innerW;
  }

  function y(val: number): number {
    return PAD_T + innerH - (val / maxCount) * innerH;
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.count)}`)
    .join(' ');

  const areaPath = `${linePath} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-semibold mb-4">CVE Discovery Timeline</h2>
      <p className="text-xs text-neutral-500 mb-4">
        New CVEs discovered per day over the last 30 days
      </p>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        role="img"
        aria-label="CVE timeline chart"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L}
              y1={y(tick)}
              x2={CHART_W - PAD_R}
              y2={y(tick)}
              stroke="#404040"
              strokeDasharray="4 4"
            />
            <text
              x={PAD_L - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-neutral-500"
              fontSize="11"
            >
              {tick}
            </text>
          </g>
        ))}

        {[0, 9, 19, 29].map((i) =>
          data[i] ? (
            <text
              key={i}
              x={x(i)}
              y={CHART_H - 4}
              textAnchor="middle"
              className="fill-neutral-500"
              fontSize="10"
            >
              {data[i].date.slice(5)}
            </text>
          ) : null
        )}

        <path d={areaPath} fill="url(#cve-gradient)" opacity="0.3" />
        <path
          d={linePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {data.map((d, i) => (
          <circle
            key={d.date}
            cx={x(i)}
            cy={y(d.count)}
            r="3"
            fill="#3b82f6"
            className="opacity-0 hover:opacity-100 transition-opacity"
          >
            <title>
              {d.date}: {d.count} CVEs
            </title>
          </circle>
        ))}

        <defs>
          <linearGradient id="cve-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
