'use client';

import type { TeamMember } from './types';

interface LeaderboardProps {
  members: TeamMember[];
}

export function Leaderboard({ members }: LeaderboardProps) {
  const sorted = [...members].sort((a, b) => b.findingsResolved - a.findingsResolved);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6" data-testid="leaderboard">
      <h3 className="text-lg font-medium mb-4">Team Leaderboard (30 days)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="pb-3 font-medium">Team Member</th>
              <th className="pb-3 font-medium">Role</th>
              <th className="pb-3 font-medium text-right">Findings Resolved</th>
              <th className="pb-3 font-medium text-right">Avg Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {sorted.map((member, idx) => (
              <tr key={member.name} className="hover:bg-neutral-800/30 transition-colors">
                <td className="py-3 font-medium text-neutral-200">
                  <span className="flex items-center gap-2">
                    {idx === 0 && <GoldBadge />}
                    {member.name}
                  </span>
                </td>
                <td className="py-3 text-neutral-400">{member.role}</td>
                <td className="py-3 text-right font-semibold">{member.findingsResolved}</td>
                <td className="py-3 text-right text-neutral-400">{member.avgResolutionHours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GoldBadge() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400"
      title="Top performer"
      data-testid="gold-badge"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 1L7.5 4.1L11 4.6L8.5 7L9.2 10.5L6 8.8L2.8 10.5L3.5 7L1 4.6L4.5 4.1L6 1Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
