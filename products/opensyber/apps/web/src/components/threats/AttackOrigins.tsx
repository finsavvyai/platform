'use client';

import { motion } from 'framer-motion';

interface CountryData {
  country: string | null;
  eventCount: number;
}

interface AttackOriginsProps {
  countries: CountryData[];
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    code.charCodeAt(0) + 127397,
    code.charCodeAt(1) + 127397,
  );
}

export function AttackOrigins({ countries }: AttackOriginsProps) {
  const max = countries.length > 0 ? countries[0].eventCount : 1;

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-semibold mb-4">Attack Origins</h3>
      {countries.length === 0 ? (
        <p className="text-sm text-text-dim">No geographic data available.</p>
      ) : (
        <div className="space-y-3">
          {countries.map((item, i) => {
            const pct = Math.round((item.eventCount / max) * 100);
            return (
              <div key={item.country ?? i} className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">
                  {countryFlag(item.country) || '🌐'}
                </span>
                <span className="text-sm text-text-primary w-8 uppercase">
                  {item.country ?? '??'}
                </span>
                <div className="flex-1 h-5 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-red-500/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: i * 0.05, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const }}
                  />
                </div>
                <span className="text-sm font-medium text-text-secondary w-12 text-right">
                  {item.eventCount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
