'use client';

import { useEffect, useState } from 'react';
import { UsersRound, AlertTriangle, Key, Terminal, Users, Shield } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { type TeamSummary, type TeamMember, type RiskScore, gradeColor, scoreToGrade } from './types';
import { TeamSkeleton } from '@/components/dashboard/TeamSkeleton';
import { RiskTrendChart } from '@/components/dashboard/RiskTrendChart';

export default function TeamAgentsPage() {
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/agents/team').then((r) => r.json()),
      fetch('/api/proxy/agents/team/members').then((r) => r.json()),
      fetch('/api/proxy/agents/team/risk-score').then((r) => r.json()).catch(() => null),
    ])
      .then(([teamData, memberData, riskData]) => {
        setSummary(teamData.data ?? null);
        setMembers(memberData.data ?? []);
        if (riskData) {
          setRiskScore(riskData.data ?? riskData ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <TeamSkeleton />;
  }

  if (!summary) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-2">Team Agents</h1>
        <p className="text-sm text-text-secondary mb-8">Agent activity across your organization</p>
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <UsersRound className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">No team activity yet</p>
          <p className="mt-2 text-sm text-text-dim">
            Team members need to install the OpenAgent extension and enable cloud sync.
          </p>
        </div>
      </div>
    );
  }

  const score = riskScore?.combined ?? 0;
  const grade = riskScore?.grade ?? scoreToGrade(score);

  const stats = [
    { label: 'Total Events', value: summary.total, color: 'text-signal', icon: Terminal },
    { label: 'Critical', value: summary.critical, color: 'text-red-400', icon: AlertTriangle },
    { label: 'High', value: summary.high, color: 'text-amber-400', icon: AlertTriangle },
    { label: 'Medium', value: summary.medium, color: 'text-yellow-400', icon: AlertTriangle },
    { label: 'Secrets', value: summary.secretsDetected, color: 'text-red-400', icon: Key },
    { label: 'Members', value: summary.uniqueUsers, color: 'text-green-400', icon: Users },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Team Agents</h1>
        <p className="mt-1 text-sm text-text-secondary">Agent activity across your organization</p>
      </div>

      <div className="mb-6 rounded border border-border bg-panel/50 p-6 flex items-center gap-8">
        <div className="text-center">
          <p className={`text-5xl font-black ${gradeColor(grade)}`}>{score}</p>
          <p className={`text-2xl font-bold mt-1 ${gradeColor(grade)}`}>{grade}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Combined Risk Score</p>
          <p className="text-xs text-text-secondary mt-1">
            Agent: {riskScore?.agent ?? 0} | CSPM: {riskScore?.cspm ?? 0}
          </p>
        </div>
        <div className="ml-auto">
          <Shield className="h-8 w-8 text-neutral-700" />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded border border-border bg-panel/30 p-4">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-text-dim">
              <Icon className="h-3 w-3" />
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Org-level risk trend chart */}
      <RiskTrendChart endpoint="/api/proxy/agents/team/risk-trend" days={30} />

      <div className="overflow-x-auto rounded border border-border bg-panel/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="px-6 py-3 font-medium">Member</th>
              <th className="px-6 py-3 font-medium">Risk Score</th>
              <th className="px-6 py-3 font-medium">Events</th>
              <th className="px-6 py-3 font-medium">Critical</th>
              <th className="px-6 py-3 font-medium">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {members.map((m) => {
              const memberRiskScore = m.riskScore ?? 0;
              return (
                <tr
                  key={m.userId}
                  className="hover:bg-surface/30 transition cursor-pointer"
                  onClick={() => { window.location.href = `/dashboard/agents/team/${m.userId}`; }}
                >
                  <td className="px-6 py-3">
                    <p className="font-medium">{m.name ?? m.userId}</p>
                    {m.email && <p className="text-xs text-text-dim">{m.email}</p>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`font-bold ${gradeColor(scoreToGrade(memberRiskScore))}`}>
                      {memberRiskScore}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-secondary">{m.total}</td>
                  <td className="px-6 py-3">
                    <span className={m.critical > 0 ? 'text-red-400 font-medium' : 'text-text-dim'}>
                      {m.critical}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-dim">
                    {m.lastActivityAt ? formatDate(m.lastActivityAt) : 'Never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
