'use client';

import type { RuntimeContainer } from './types';
import { STATUS_COLORS } from './types';

interface Props {
  containers: RuntimeContainer[];
}

function riskColor(score: number): string {
  if (score >= 80) return 'text-red-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-green-400';
}

function usageBarColor(percent: number): string {
  if (percent >= 80) return 'bg-red-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-green-500';
}

export function RuntimeContainerList({
  containers,
}: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Runtime Containers</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="px-6 py-3 font-medium">Container ID</th>
              <th className="px-6 py-3 font-medium">Image</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">CPU</th>
              <th className="px-6 py-3 font-medium">Memory</th>
              <th className="px-6 py-3 font-medium">Uptime</th>
              <th className="px-6 py-3 font-medium">Risk Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {containers.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-neutral-800/30 transition"
              >
                <td className="px-6 py-3 font-mono text-xs text-neutral-400">
                  {c.containerId.slice(0, 12)}
                </td>
                <td className="px-6 py-3 font-medium">{c.imageName}</td>
                <td className="px-6 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${STATUS_COLORS[c.status]}`}
                    />
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usageBarColor(c.cpuPercent)}`}
                        style={{ width: `${c.cpuPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-400">
                      {c.cpuPercent}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usageBarColor(c.memPercent)}`}
                        style={{ width: `${c.memPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-400">
                      {c.memPercent}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-neutral-400">{c.uptime}</td>
                <td className="px-6 py-3">
                  <span className={`font-semibold ${riskColor(c.riskScore)}`}>
                    {c.riskScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
