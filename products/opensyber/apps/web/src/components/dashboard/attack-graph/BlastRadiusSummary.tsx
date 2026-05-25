'use client';

import { ShieldAlert, Crown, Layers, Target } from 'lucide-react';

interface BlastRadiusInfo {
  score: number;
  totalReachable: number;
  crownJewelsReached: number;
  byType: Record<string, number>;
  bySensitivity: Record<string, number>;
}

function getGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'F', color: 'text-red-500' };
  if (score >= 70) return { grade: 'D', color: 'text-amber-500' };
  if (score >= 50) return { grade: 'C', color: 'text-yellow-500' };
  if (score >= 30) return { grade: 'B', color: 'text-signal' };
  return { grade: 'A', color: 'text-green-500' };
}

const SENSITIVITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-info', low: 'bg-neutral-400', info: 'bg-neutral-600',
};

export function BlastRadiusSummary({ data }: { data: BlastRadiusInfo }) {
  const { grade, color } = getGrade(data.score);

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-red-500" />
        Blast Radius Summary
      </h2>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="text-center">
          <p className={`text-5xl font-bold ${color}`}>{grade}</p>
          <p className="text-xs text-text-dim mt-1">Score: {data.score}/100</p>
        </div>
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-signal" />
          <div>
            <p className="text-2xl font-bold">{data.totalReachable}</p>
            <p className="text-xs text-text-dim">Assets Reachable</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Crown className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-2xl font-bold">{data.crownJewelsReached}</p>
            <p className="text-xs text-text-dim">Crown Jewels at Risk</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <div>
            <p className="text-2xl font-bold">{data.bySensitivity['critical'] ?? 0}</p>
            <p className="text-xs text-text-dim">Critical Assets</p>
          </div>
        </div>
      </div>

      {/* Sensitivity breakdown bar */}
      <div className="mt-6">
        <p className="text-xs text-text-dim mb-2">By Sensitivity</p>
        <div className="flex h-3 rounded-full overflow-hidden bg-surface">
          {Object.entries(data.bySensitivity).map(([level, count]) => (
            <div
              key={level}
              className={`${SENSITIVITY_COLORS[level] ?? 'bg-neutral-600'}`}
              style={{ width: `${(count / Math.max(data.totalReachable, 1)) * 100}%` }}
              title={`${level}: ${count}`}
            />
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          {Object.entries(data.bySensitivity).map(([level, count]) => (
            <span key={level} className="flex items-center gap-1 text-xs text-text-secondary">
              <span className={`inline-block h-2 w-2 rounded-full ${SENSITIVITY_COLORS[level]}`} />
              {level}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
