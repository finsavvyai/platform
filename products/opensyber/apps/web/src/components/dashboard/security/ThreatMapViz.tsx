'use client';

import { Globe2 } from 'lucide-react';

interface ThreatCountry {
  country: string;
  eventCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500/20 border-red-500/40 text-red-400',
  high: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  medium: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  low: 'bg-signal/20 border-info/40 text-signal',
};

export function ThreatMapViz({ countries }: { countries: ThreatCountry[] }) {
  if (!countries || countries.length === 0) return null;

  const maxCount = Math.max(...countries.map((c) => c.eventCount));

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Globe2 className="h-5 w-5 text-text-secondary" />
        Threat Origins
      </h3>
      <div className="flex flex-wrap gap-3 justify-center">
        {countries.map((entry, i) => {
          const size = Math.max(48, Math.min(96, 48 + (entry.eventCount / maxCount) * 48));
          return (
            <div
              key={`${entry.country}-${i}`}
              title={`${entry.country}: ${entry.eventCount} events (${entry.severity})`}
              className={`flex flex-col items-center justify-center rounded-full border transition hover:scale-110 ${severityStyles[entry.severity] ?? 'bg-surface border-wire text-text-secondary'}`}
              style={{ width: size, height: size }}
            >
              <span className="text-xs font-bold leading-none">
                {entry.country.slice(0, 3).toUpperCase()}
              </span>
              <span className="text-[10px] opacity-70">{entry.eventCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
