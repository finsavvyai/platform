import Link from 'next/link';
import { Activity } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { SecurityDashboard } from './dashboard-types';
import { severityColors } from './dashboard-types';

export function RecentEvents({ security }: { security: SecurityDashboard | null }) {
  return (
    <div className="brand-card rounded p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-text-secondary" aria-hidden="true" />
        Recent Security Events
      </h2>
      {security && (security.recentEvents?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          {security.recentEvents?.slice(0, 5).map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded bg-surface/60 px-4 py-3 min-h-[44px]">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-wider ${severityColors[event.severity] ?? 'bg-border text-text-secondary'}`}>
                  {event.severity}
                </span>
                <span className="text-sm font-[family-name:var(--font-mono)]">{event.eventType}</span>
              </div>
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-dim">{formatDate(event.createdAt)}</span>
            </div>
          ))}
          <Link
            href="/dashboard/security"
            className="inline-flex items-center min-h-[44px] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-signal hover:text-signal-hover transition-colors duration-200 pt-1"
          >
            View all events &rarr;
          </Link>
        </div>
      ) : (
        <p className="text-sm text-text-dim">
          No security events yet. Events will appear here once your instance is running.
        </p>
      )}
    </div>
  );
}
