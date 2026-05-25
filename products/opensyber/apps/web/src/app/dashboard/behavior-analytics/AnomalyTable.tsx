'use client';

import { type AnomalyEvent, SEVERITY_COLORS } from './types';

interface Props {
  anomalies: AnomalyEvent[];
  onInvestigate: (userId: string) => void;
  onDismiss: (id: string) => void;
  onSuspend: (userId: string) => void;
}

export function AnomalyTable({
  anomalies,
  onInvestigate,
  onDismiss,
  onSuspend,
}: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Anomaly Alerts</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900/50 border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Anomaly Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Risk Delta</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Time</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {anomalies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No anomalies detected.
                </td>
              </tr>
            ) : (
              anomalies.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-800/30 transition">
                  <td className="px-4 py-3 font-medium">{a.userName}</td>
                  <td className="px-4 py-3 text-neutral-400">{a.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_COLORS[a.severity]}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-400">+{a.riskDelta}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {new Date(a.time).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onInvestigate(a.userId)}
                        className="rounded px-2 py-1 text-xs text-info hover:bg-info/10 transition"
                      >
                        Investigate
                      </button>
                      <button
                        onClick={() => onDismiss(a.id)}
                        className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700/50 transition"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => onSuspend(a.userId)}
                        className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition"
                      >
                        Suspend
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
