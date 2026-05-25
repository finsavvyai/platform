import { Cpu, MemoryStick, HardDrive, Crosshair } from 'lucide-react';
import type { HealthData, SecurityDashboard } from './dashboard-types';
import { progressColor, scoreColor } from './dashboard-types';

export function StatsGrid({ health, security }: { health: HealthData | null; security: SecurityDashboard | null }) {
  const metrics = [
    { label: 'CPU Usage', icon: Cpu, value: health?.cpuPercent },
    { label: 'Memory', icon: MemoryStick, value: health?.memoryPercent },
    { label: 'Disk', icon: HardDrive, value: health?.diskPercent },
  ];

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-4">
      <div className="brand-card rounded p-5 group relative" tabIndex={0} role="group" aria-label="Security Score">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Crosshair className="h-4 w-4 text-signal" aria-hidden="true" />
          <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">Security Score</span>
        </div>
        {security ? (
          <>
            <div className={`font-[family-name:var(--font-display)] text-4xl ${scoreColor(security.score.overall)}`}>
              {security.score.overall}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim mt-1">out of 100</div>
            {(security.score.recommendations?.length ?? 0) > 0 && (
              <div className="invisible group-hover:visible group-focus-within:visible absolute left-0 top-full z-20 mt-2 w-72 rounded border border-border bg-panel p-4 shadow-xl" role="tooltip">
                <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-primary uppercase tracking-wider mb-2">Improve your score</p>
                <ul className="space-y-1">
                  {security.score.recommendations?.slice(0, 5).map((rec) => (
                    <li key={rec} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-warn shrink-0">&#x2022;</span>{rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="font-[family-name:var(--font-display)] text-4xl text-text-dim">&mdash;</div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim mt-1">Awaiting data</div>
          </>
        )}
      </div>
      {metrics.map(({ label, icon: Icon, value }) => (
        <div key={label} className="brand-card rounded p-5">
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider">{label}</span>
          </div>
          {value !== undefined && value !== null ? (
            <>
              <div className="font-[family-name:var(--font-display)] text-4xl">{Math.round(value)}%</div>
              <div
                className="mt-2 h-1 rounded-full bg-border overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(value)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label}: ${Math.round(value)}%`}
              >
                <div
                  className={`h-full rounded-full ${progressColor(value)} transition-all duration-300 ease-out`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="font-[family-name:var(--font-display)] text-4xl text-text-dim">&mdash;</div>
              <div className="mt-2 h-1 rounded-full bg-border" role="progressbar" aria-label={`${label}: no data`} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
