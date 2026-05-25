'use client';

import { Play, Terminal, Globe, Zap } from 'lucide-react';
import type { SessionRecording } from './types';

interface SessionTableProps {
  sessions: SessionRecording[];
  onPlay: (session: SessionRecording) => void;
}

const typeIcons = { SSH: Terminal, Web: Globe, API: Zap };
const typeBg = { SSH: 'bg-info/10 text-info', Web: 'bg-green-500/10 text-green-400', API: 'bg-amber-500/10 text-amber-400' };

function StatusBadge({ status }: { status: SessionRecording['status'] }): React.ReactElement {
  const map = {
    active: 'bg-green-500/10 text-green-400',
    completed: 'bg-neutral-800 text-neutral-400',
    flagged: 'bg-red-500/10 text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>
      {status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function RiskBadge({ score }: { score: number }): React.ReactElement {
  const color = score >= 70 ? 'text-red-400 bg-red-500/10' : score >= 40 ? 'text-amber-400 bg-amber-500/10' : 'text-green-400 bg-green-500/10';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{score}</span>;
}

export function SessionTable({ sessions, onPlay }: SessionTableProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center">
        <Terminal className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
        <p className="text-lg font-medium text-neutral-300">No sessions match your filters</p>
        <p className="mt-2 text-sm text-neutral-500">Try adjusting your filter criteria</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-400">
            <th className="p-4 font-medium">User</th>
            <th className="p-4 font-medium">Type</th>
            <th className="p-4 font-medium">Target</th>
            <th className="p-4 font-medium">Duration</th>
            <th className="p-4 font-medium">Risk</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {sessions.map((s) => {
            const Icon = typeIcons[s.sessionType];
            return (
              <tr key={s.id} className="hover:bg-neutral-800/30 transition">
                <td className="p-4">
                  <p className="font-medium text-neutral-200">{s.user}</p>
                  <p className="text-xs text-neutral-500">{s.userEmail}</p>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBg[s.sessionType]}`}>
                    <Icon className="h-3 w-3" /> {s.sessionType}
                  </span>
                </td>
                <td className="p-4 text-neutral-300 font-mono text-xs">{s.target}</td>
                <td className="p-4 text-neutral-300">{s.duration}m</td>
                <td className="p-4"><RiskBadge score={s.riskScore} /></td>
                <td className="p-4"><StatusBadge status={s.status} /></td>
                <td className="p-4">
                  <button
                    onClick={() => onPlay(s)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-medium text-white hover:bg-info transition"
                  >
                    <Play className="h-3 w-3" /> Play
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
