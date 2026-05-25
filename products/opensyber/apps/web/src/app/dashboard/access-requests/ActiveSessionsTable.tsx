'use client';

import { useEffect, useState } from 'react';
import { Clock, Plus, XCircle, Shield } from 'lucide-react';
import type { ActiveSession } from './types';
import { LevelBadge } from './AccessBadges';

interface ActiveSessionsTableProps {
  sessions: ActiveSession[];
}

function useCountdown(expiresAt: string): { text: string; color: string } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { text: 'Expired', color: 'text-red-400' };

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const text = minutes > 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m ${seconds}s`;
  const color = minutes > 30 ? 'text-green-400' : minutes > 5 ? 'text-amber-400' : 'text-red-400';

  return { text, color };
}

function CountdownCell({ expiresAt }: { expiresAt: string }): React.ReactElement {
  const { text, color } = useCountdown(expiresAt);
  return (
    <span className={`font-mono text-xs font-medium ${color}`}>
      <Clock className="inline h-3 w-3 mr-1" />
      {text}
    </span>
  );
}

export function ActiveSessionsTable({ sessions }: ActiveSessionsTableProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-8 text-center mb-8">
        <Shield className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
        <p className="text-neutral-300">No active elevated sessions</p>
        <p className="text-xs text-neutral-500 mt-1">All access is at baseline privileges</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Active Sessions</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium">Resource</th>
              <th className="p-4 font-medium">Level</th>
              <th className="p-4 font-medium">Started</th>
              <th className="p-4 font-medium">Expires In</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-neutral-800/30 transition">
                <td className="p-4 font-medium text-neutral-200">{s.user}</td>
                <td className="p-4 text-neutral-300">{s.resource}</td>
                <td className="p-4"><LevelBadge level={s.level} /></td>
                <td className="p-4 text-neutral-400 text-xs">
                  {new Date(s.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="p-4"><CountdownCell expiresAt={s.expiresAt} /></td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1 rounded-lg border border-info px-2.5 py-1.5 text-xs text-info hover:bg-info/10 transition">
                      <Plus className="h-3 w-3" /> Extend
                    </button>
                    <button className="flex items-center gap-1 rounded-lg border border-red-800 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition">
                      <XCircle className="h-3 w-3" /> Revoke
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
