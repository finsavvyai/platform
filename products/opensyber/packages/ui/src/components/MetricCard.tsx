import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number | null;
  subtext?: string;
  showBar?: boolean;
  barPercent?: number;
}

export function MetricCard({
  icon,
  label,
  value,
  subtext,
  showBar,
  barPercent,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
      <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold">
        {value !== null && value !== undefined ? (
          value
        ) : (
          <span className="text-neutral-500">&mdash;</span>
        )}
      </div>
      {subtext && (
        <div className="text-xs text-neutral-500 mt-1">{subtext}</div>
      )}
      {showBar && (
        <div
          role="progressbar"
          aria-valuenow={barPercent !== undefined ? Math.min(100, Math.max(0, barPercent)) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} progress`}
          className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden"
        >
          {barPercent !== undefined && barPercent > 0 && (
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, barPercent)}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}
