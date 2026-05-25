'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Activity } from 'lucide-react';

export interface RiskTrendPoint {
  date: string;
  agentScore: number;
  cspmScore: number;
  combinedScore: number;
  grade: string;
}

interface Props {
  endpoint: string;
  days?: number;
}

const colors = {
  combined: '#3b82f6', // blue-500
  agent: '#22c55e', // green-500
  cspm: '#f59e0b', // amber-500
};

export function RiskTrendChart({ endpoint, days = 30 }: Props) {
  const [data, setData] = useState<RiskTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${endpoint}?days=${days}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch trend data');
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [endpoint, days]);

  if (loading) {
    return (
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-text-secondary" />
          Risk Trend
        </h3>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-full h-40 bg-surface/50 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || data.length < 2) {
    return (
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-text-secondary" />
          Risk Trend
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity className="h-8 w-8 text-text-dim mb-2" />
          <p className="text-sm text-text-dim">
            {error || 'Risk trend data will appear after a few days of monitoring.'}
          </p>
        </div>
      </div>
    );
  }

  const W = 600;
  const H = 200;
  const padX = 40;
  const padY = 30;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * plotW,
    yCombined: padY + plotH - (d.combinedScore / 100) * plotH,
    yAgent: padY + plotH - (d.agentScore / 100) * plotH,
    yCspm: padY + plotH - (d.cspmScore / 100) * plotH,
    ...d,
  }));

  const makePolyline = (key: 'yCombined' | 'yAgent' | 'yCspm') =>
    points.map((p) => `${p.x},${p[key]}`).join(' ');

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-text-secondary" />
          Risk Trend
        </h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded-full bg-info" />
            Combined
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded-full bg-green-500" />
            Agent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded-full bg-amber-500" />
            CSPM
          </span>
        </div>
      </div>

      <div className="w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 220 }}>
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

          {/* CSPM line */}
          <polyline points={makePolyline('yCspm')} fill="none" stroke={colors.cspm} strokeWidth={2} />

          {/* Agent line */}
          <polyline points={makePolyline('yAgent')} fill="none" stroke={colors.agent} strokeWidth={2} />

          {/* Combined line (thickest, on top) */}
          <polyline points={makePolyline('yCombined')} fill="none" stroke={colors.combined} strokeWidth={3} />

          {/* Data points for latest */}
          {points.map((p, i) => {
            if (i % 5 !== 0 && i !== points.length - 1) return null;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.yCspm} r={2} fill={colors.cspm} opacity={0.7}>
                  <title>{`${p.date}\nCSPM: ${p.cspmScore}`}</title>
                </circle>
                <circle cx={p.x} cy={p.yAgent} r={2} fill={colors.agent} opacity={0.7}>
                  <title>{`${p.date}\nAgent: ${p.agentScore}`}</title>
                </circle>
                <circle cx={p.x} cy={p.yCombined} r={3} fill={colors.combined}>
                  <title>{`${p.date}\nCombined: ${p.combinedScore} (${p.grade})`}</title>
                </circle>
              </g>
            );
          })}
        </svg>

        {/* X-axis labels (first, middle, last) */}
        <div className="flex justify-between px-10 mt-2 text-xs text-text-dim">
          <span>{data[0].date.slice(5)}</span>
          <span>{data[Math.floor(data.length / 2)].date.slice(5)}</span>
          <span>{data[data.length - 1].date.slice(5)}</span>
        </div>
      </div>
    </div>
  );
}
