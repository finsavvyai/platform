'use client';

import { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface Assessment {
  id: string;
  overallScore: number;
  grade: string;
  passingCount: number;
  failingCount: number;
  partialCount: number;
  totalControls: number;
  createdAt: string;
}

interface Props {
  assessments: Assessment[];
}

const gradeColors: Record<string, string> = {
  'A+': 'text-green-400', A: 'text-green-400', B: 'text-signal',
  C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400',
};

export function OasfClient({ assessments: initial }: Props) {
  const [assessments] = useState(initial);
  const [running, setRunning] = useState(false);

  const latest = assessments[0] ?? null;

  async function runAssessment() {
    setRunning(true);
    try {
      const res = await fetch('/api/proxy/oasf/assessments', { method: 'POST' });
      if (res.ok) window.location.reload();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">OASF Compliance</h1>
          <p className="mt-2 text-text-secondary">
            AI Agent Security Framework — 15 controls for agent governance
          </p>
        </div>
        <button
          onClick={runAssessment}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          Run Assessment
        </button>
      </div>

      {latest ? <ScoreCard assessment={latest} /> : <EmptyState />}

      {assessments.length > 0 && <HistoryTable assessments={assessments} />}
    </div>
  );
}

function ScoreCard({ assessment }: { assessment: Assessment }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="rounded border border-border bg-panel/30 p-8 text-center">
        <p className={`text-4xl sm:text-6xl font-bold ${gradeColors[assessment.grade] ?? 'text-text-secondary'}`}>
          {assessment.grade}
        </p>
        <p className="mt-2 text-2xl font-semibold">{assessment.overallScore}/100</p>
        <p className="mt-1 text-xs text-text-secondary">OASF Score</p>
      </div>
      <StatCard icon={CheckCircle} label="Passing" value={assessment.passingCount} color="green" />
      <StatCard icon={AlertTriangle} label="Partial" value={assessment.partialCount} color="amber" />
      <StatCard icon={XCircle} label="Failing" value={assessment.failingCount} color="red" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Shield; label: string; value: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400', amber: 'text-amber-400', red: 'text-red-400', blue: 'text-signal',
  };
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${colorMap[color] ?? 'text-text-secondary'}`} />
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-border bg-panel/30 py-16">
      <Shield className="h-12 w-12 text-text-dim" />
      <p className="mt-4 text-lg font-medium text-text-secondary">No assessments yet</p>
      <p className="text-sm text-text-dim">Run your first OASF compliance assessment</p>
    </div>
  );
}

function HistoryTable({ assessments }: { assessments: Assessment[] }) {
  return (
    <div className="rounded border border-border bg-panel/30">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-medium">Assessment History</h2>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-xs text-text-secondary">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Grade</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Pass</th>
            <th className="px-4 py-3">Fail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {assessments.map((a) => (
            <tr key={a.id} className="hover:bg-surface/30">
              <td className="px-4 py-3 text-sm">{new Date(a.createdAt).toLocaleDateString()}</td>
              <td className={`px-4 py-3 text-sm font-bold ${gradeColors[a.grade] ?? ''}`}>{a.grade}</td>
              <td className="px-4 py-3 text-sm">{a.overallScore}/100</td>
              <td className="px-4 py-3 text-sm text-green-400">{a.passingCount}</td>
              <td className="px-4 py-3 text-sm text-red-400">{a.failingCount}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
