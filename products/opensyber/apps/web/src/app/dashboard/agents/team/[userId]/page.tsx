'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Activity } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { TeamUserSkeleton } from '@/components/dashboard/TeamUserSkeleton';
import { RelatedFindings } from '@/components/dashboard/RelatedFindings';

interface MemberActivity {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  path: string;
  summary: string;
  secretsCount: number;
  createdAt: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-signal/10 text-signal',
};

const TYPE_COLORS: Record<string, string> = {
  file_read: 'bg-signal/10 text-signal',
  file_write: 'bg-cyan-500/10 text-cyan-400',
  bash_exec: 'bg-orange-500/10 text-orange-400',
  secret_access: 'bg-red-500/10 text-red-400',
};

export default function MemberDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [activity, setActivity] = useState<MemberActivity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/proxy/agents/team/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        setActivity(d.data ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setActivity([]);
        setLoaded(false);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <TeamUserSkeleton />;
  }

  if (!loaded) {
    return (
      <div>
        <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-white transition">
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <Activity className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">Member not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-white transition">
        <ArrowLeft className="h-4 w-4" /> Back to Team
      </button>

      <div className="mb-6 rounded border border-border bg-panel/50 p-6 flex items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold">Team Member Activity</h1>
          <p className="text-sm text-text-secondary font-mono">{userId}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm text-text-secondary">Events</p>
          <p className="text-3xl font-bold">{activity.length}</p>
        </div>
      </div>

      {activity.length === 0 ? (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <Activity className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">No activity yet</p>
          <p className="mt-2 text-sm text-text-dim">
            This member has not generated any agent activity events.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-panel/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Risk</th>
                <th className="px-6 py-3 font-medium">Path</th>
                <th className="px-6 py-3 font-medium">Summary</th>
                <th className="px-6 py-3 font-medium">Secrets</th>
                <th className="px-6 py-3 font-medium">Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {activity.map((a) => (
                <tr key={a.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3 text-text-dim whitespace-nowrap">{formatDate(a.createdAt)}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[a.type] ?? 'bg-surface text-text-primary'}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${SEV_COLORS[a.severity]}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary max-w-xs truncate">{a.path}</td>
                  <td className="px-6 py-3 text-text-secondary max-w-xs truncate">{a.summary}</td>
                  <td className="px-6 py-3">
                    {a.secretsCount > 0 ? (
                      <span className="text-red-400 font-medium">{a.secretsCount}</span>
                    ) : (
                      <span className="text-text-dim">0</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <RelatedFindings activityId={a.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
