'use client';

interface UptimeDay {
  date: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
}

interface UptimeChartProps {
  days: UptimeDay[];
  percentage: number;
  targetUptime?: number;
}

const STATUS_COLORS: Record<string, string> = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  degraded: 'bg-amber-500',
  unknown: 'bg-neutral-700',
};

export function UptimeChart({ days, percentage, targetUptime }: UptimeChartProps) {
  const meetsTarget = !targetUptime || percentage >= targetUptime;

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <p className="text-xs text-text-secondary mb-1">Overall Uptime</p>
          <p className={`text-4xl font-bold ${meetsTarget ? 'text-green-400' : 'text-red-400'}`}>
            {percentage.toFixed(3)}%
          </p>
        </div>
        {targetUptime && (
          <div className="text-right">
            <p className="text-xs text-text-secondary mb-1">SLA Target</p>
            <p className="text-lg font-semibold text-text-primary">{targetUptime}%</p>
          </div>
        )}
      </div>

      <p className="text-xs text-text-dim mb-2">Last {days.length} days</p>
      <div className="flex gap-0.5">
        {days.map((day) => (
          <div
            key={day.date}
            className={`flex-1 h-8 rounded-sm ${STATUS_COLORS[day.status]} transition hover:opacity-80`}
            title={`${day.date}: ${day.status}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-text-dim">
        <span>{days.length > 0 ? days[0].date : ''}</span>
        <span>Today</span>
      </div>

      <div className="mt-4 flex gap-4">
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'unknown').map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
            <span className="text-xs text-text-secondary capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
