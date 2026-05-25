'use client';

import type { Milestone } from './types';

interface MilestoneTimelineProps {
  milestones: Milestone[];
}

const iconPaths: Record<string, string> = {
  shield: 'M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z',
  award: 'M12 2l2.4 4.8 5.3.8-3.85 3.7.9 5.3L12 14.3l-4.75 2.5.9-5.3L4.3 7.6l5.3-.8L12 2z',
  zap: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6" data-testid="milestone-timeline">
      <h3 className="text-lg font-medium mb-6">Recent Milestones</h3>
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-neutral-800" />
        <div className="space-y-6">
          {milestones.map((m) => (
            <div key={m.title} className="flex items-start gap-4 pl-1">
              <div className="relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d={iconPaths[m.icon] ?? iconPaths.check} fill="#a3a3a3" />
                </svg>
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-medium text-neutral-200">{m.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{formatDate(m.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
