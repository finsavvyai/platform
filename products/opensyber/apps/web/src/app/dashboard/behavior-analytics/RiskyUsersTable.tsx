'use client';

import { type RiskyUser, STATUS_COLORS } from './types';

interface Props {
  users: RiskyUser[];
  onSelect: (userId: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-green-400';
}

export function RiskyUsersTable({
  users,
  onSelect,
}: Props): React.ReactElement {
  const sorted = [...users].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Top Risky Users</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900/50 border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Risk Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Anomalies</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Last Anomaly</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {sorted.map((u) => (
              <tr
                key={u.id}
                onClick={() => onSelect(u.id)}
                className="hover:bg-neutral-800/30 transition cursor-pointer"
              >
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-neutral-400">{u.email}</td>
                <td className={`px-4 py-3 font-bold ${scoreColor(u.riskScore)}`}>
                  {u.riskScore}
                </td>
                <td className="px-4 py-3 text-neutral-400">{u.anomalyCount}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">
                  {u.lastAnomaly
                    ? new Date(u.lastAnomaly).toLocaleDateString()
                    : 'None'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[u.status]}`}>
                    {u.status}
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
