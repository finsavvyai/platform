'use client';

import type { SecurityScoreTrend, RiskDistribution } from './types';

interface ScoreTrendChartProps {
  data: SecurityScoreTrend[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length < 2) return null;

  const width = 500;
  const height = 200;
  const pad = { top: 10, right: 10, bottom: 30, left: 40 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const scores = data.map((d) => d.score);
  const minS = Math.max(0, Math.min(...scores) - 5);
  const maxS = Math.min(100, Math.max(...scores) + 5);

  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * iw;
  const yScale = (v: number) => pad.top + ih - ((v - minS) / (maxS - minS)) * ih;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.score)}`).join(' ');

  const yTicks = [minS, Math.round((minS + maxS) / 2), maxS];
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h3 className="text-lg font-medium mb-4">Security Score Trend</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" data-testid="score-trend-chart">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} y1={yScale(t)} x2={width - pad.right} y2={yScale(t)} stroke="#262626" />
            <text x={pad.left - 6} y={yScale(t) + 4} fill="#737373" fontSize="10" textAnchor="end">{t}</text>
          </g>
        ))}
        {xLabels.map((idx) => (
          <text key={idx} x={xScale(idx)} y={height - 6} fill="#737373" fontSize="9" textAnchor="middle">
            {data[idx].date.slice(5)}
          </text>
        ))}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {data.length > 0 && (
          <circle cx={xScale(data.length - 1)} cy={yScale(data[data.length - 1].score)} r="4" fill="#3b82f6" />
        )}
      </svg>
    </div>
  );
}

interface RiskTrendChartProps {
  data: RiskDistribution[];
}

export function RiskTrendChart({ data }: RiskTrendChartProps) {
  if (data.length < 2) return null;

  const width = 500;
  const height = 200;
  const pad = { top: 10, right: 10, bottom: 30, left: 40 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const maxTotal = Math.max(...data.map((d) => d.critical + d.high + d.medium + d.low));
  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * iw;
  const yScale = (v: number) => pad.top + ih - (v / maxTotal) * ih;

  const layers: { key: string; color: string; values: number[] }[] = [
    { key: 'low', color: '#22c55e', values: data.map((d) => d.low) },
    { key: 'medium', color: '#f59e0b', values: data.map((d) => d.medium) },
    { key: 'high', color: '#f97316', values: data.map((d) => d.high) },
    { key: 'critical', color: '#ef4444', values: data.map((d) => d.critical) },
  ];

  const stacked = layers.map((layer, li) => {
    const base = data.map((_, di) =>
      layers.slice(0, li).reduce((s, l) => s + l.values[di], 0)
    );
    const top = base.map((b, di) => b + layer.values[di]);
    return { ...layer, base, top };
  });

  function areaPath(base: number[], top: number[]): string {
    const forward = top.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ');
    const backward = base.map((v, i) => `L${xScale(base.length - 1 - i)},${yScale(v)}`).reverse().join(' ');
    return `${forward} ${backward.replace('L', 'L')} Z`;
  }

  const xLabels = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h3 className="text-lg font-medium mb-4">Risk Distribution Trend</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" data-testid="risk-trend-chart">
        {xLabels.map((idx) => (
          <text key={idx} x={xScale(idx)} y={height - 6} fill="#737373" fontSize="9" textAnchor="middle">
            {data[idx].date.slice(5)}
          </text>
        ))}
        {stacked.map((layer) => (
          <path key={layer.key} d={areaPath(layer.base, layer.top)} fill={layer.color} opacity={0.6} />
        ))}
      </svg>
      <div className="flex gap-4 mt-3 justify-center">
        {[
          { label: 'Critical', color: 'bg-red-500' },
          { label: 'High', color: 'bg-orange-500' },
          { label: 'Medium', color: 'bg-amber-500' },
          { label: 'Low', color: 'bg-green-500' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
