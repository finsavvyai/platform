'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface ScorePoint {
  date: string;
  score: number;
}

function scoreStrokeColor(score: number) {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

export function ScoreHistoryChart({ data }: { data: ScorePoint[] }) {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');

  const filteredData = data?.length > 0 ? data : [];

  if (filteredData.length < 2) {
    return (
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-text-secondary" />
          Score History
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-text-dim">
            Score history will appear here after a few days of monitoring.
          </p>
        </div>
      </div>
    );
  }

  const latestScore = filteredData[filteredData.length - 1].score;
  const color = scoreStrokeColor(latestScore);
  const W = 600;
  const H = 180;
  const padX = 40;
  const padY = 20;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const points = filteredData.map((d, i) => ({
    x: padX + (i / (filteredData.length - 1)) * plotW,
    y: padY + plotH - (d.score / 100) * plotH,
    ...d,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0].x},${padY + plotH} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${padY + plotH} Z`;

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-text-secondary" />
          Score History
        </h3>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-lg transition ${
                range === r
                  ? 'bg-neutral-700 text-white'
                  : 'text-text-dim hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((v) => {
            const y = padY + plotH - (v / 100) * plotH;
            return (
              <g key={v}>
                <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#262626" strokeDasharray="4 4" />
                <text x={padX - 8} y={y + 4} textAnchor="end" fill="#525252" fontSize={10}>
                  {v}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill={color} opacity={0.1} />

          {/* Line */}
          <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} />

          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill={color}>
              <title>{`${p.date}: ${p.score}/100`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
