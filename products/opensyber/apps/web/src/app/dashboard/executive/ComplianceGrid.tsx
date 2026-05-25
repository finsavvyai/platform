'use client';

import type { ComplianceFramework } from './types';

interface ComplianceGridProps {
  frameworks: ComplianceFramework[];
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function getStatusBadge(score: number): { label: string; className: string } {
  if (score >= 90) return { label: 'Passing', className: 'bg-green-500/10 text-green-400' };
  if (score >= 70) return { label: 'Needs Attention', className: 'bg-amber-500/10 text-amber-400' };
  return { label: 'Failing', className: 'bg-red-500/10 text-red-400' };
}

function getProgressColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

export function ComplianceGrid({ frameworks }: ComplianceGridProps) {
  return (
    <div data-testid="compliance-grid">
      <h3 className="text-lg font-medium mb-4">Compliance Overview</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {frameworks.map((fw) => {
          const status = getStatusBadge(fw.score);
          const total = fw.passed + fw.failed + fw.partial;
          return (
            <div key={fw.shortName} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">{fw.name}</h4>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className={`text-3xl font-bold ${getScoreColor(fw.score)}`}>{fw.score}</span>
                <span className="text-sm text-neutral-400">%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-neutral-800 mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${fw.score}%`, backgroundColor: getProgressColor(fw.score) }}
                />
              </div>
              <div className="flex gap-4 text-xs text-neutral-400">
                <span><span className="text-green-400 font-medium">{fw.passed}</span> / {total} passed</span>
                <span><span className="text-red-400 font-medium">{fw.failed}</span> failed</span>
                <span><span className="text-amber-400 font-medium">{fw.partial}</span> partial</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
