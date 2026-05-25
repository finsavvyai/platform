'use client';

import type { ApiVulnerability } from './types';

interface Props {
  vulnerabilities: ApiVulnerability[];
}

const SEV_COLORS: Record<string, string> = {
  Critical: 'border-red-500/30 bg-red-500/5',
  High: 'border-amber-500/30 bg-amber-500/5',
  Medium: 'border-info/30 bg-info/5',
};

const SEV_BADGE: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  High: 'bg-amber-500/20 text-amber-400',
  Medium: 'bg-info/20 text-info',
};

export function TopVulnerabilities({ vulnerabilities }: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-semibold mb-4">Top API Vulnerabilities (OWASP API Top 10)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vulnerabilities.map((v) => (
          <div
            key={v.id}
            className={`rounded-lg border p-4 ${SEV_COLORS[v.severity]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">{v.category}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs ${SEV_BADGE[v.severity]}`}>
                {v.severity}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">{v.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">Affected endpoints</span>
              <span className="text-sm font-bold text-neutral-300">{v.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
