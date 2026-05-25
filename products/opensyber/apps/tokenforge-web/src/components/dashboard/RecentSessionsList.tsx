import Link from 'next/link';
import type { Session } from './types';

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  revoked: 'bg-red-500/10 text-red-400',
  expired: 'bg-amber-500/10 text-amber-400',
};

function trustColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface RecentSessionsListProps {
  sessions: Session[];
}

export function RecentSessionsList({
  sessions,
}: RecentSessionsListProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No sessions yet. Sessions will appear once devices are bound.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between rounded-lg bg-neutral-800/30 px-4 py-3"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-neutral-300">
              {session.deviceId.slice(0, 12)}...
            </span>
            <span className={`text-sm font-medium ${trustColor(session.trustScore)}`}>
              {session.trustScore}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[session.status] ?? ''}`}
            >
              {session.status}
            </span>
          </div>
          <span className="text-xs text-neutral-500">
            {formatTime(session.boundAt)}
          </span>
        </div>
      ))}
      <Link
        href="/dashboard/sessions"
        className="block pt-2 text-sm text-info hover:text-info"
      >
        View all sessions &rarr;
      </Link>
    </div>
  );
}
