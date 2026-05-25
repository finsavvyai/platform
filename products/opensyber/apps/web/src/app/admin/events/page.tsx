import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Activity } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Admin — Events' };

interface EventRow {
  id: string;
  instanceId: string;
  type: string;
  severity: string;
  message: string | null;
  createdAt: string;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-signal/20 text-signal',
  info: 'bg-neutral-500/20 text-text-secondary',
};

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const token = await getApiToken();

  let events: EventRow[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  try {
    if (token) {
      const qs = params.cursor ? `?cursor=${params.cursor}` : '';
      const data = await apiClient<{ data: EventRow[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/admin/events${qs}`, { token },
      );
      events = data.data;
      nextCursor = data.nextCursor;
      hasMore = data.hasMore;
    }
  } catch (err) { console.error('[AdminEvents] Failed to fetch events:', err instanceof Error ? err.message : err); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Events</h1>
        <p className="mt-1 text-sm text-text-secondary">System-wide security event stream</p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Activity className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No events</h3>
          <p className="text-sm text-text-secondary">Security events will appear here.</p>
        </div>
      ) : (
        <>
          <div className="rounded border border-border bg-panel/30 overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Message</th>
                  <th className="px-6 py-3 font-medium">Instance</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface/30 transition">
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${severityColors[event.severity] ?? severityColors.info}`}>
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{event.type}</td>
                    <td className="px-6 py-3 text-text-secondary max-w-md truncate">{event.message ?? '—'}</td>
                    <td className="px-6 py-3 font-mono text-xs text-text-dim">{event.instanceId}</td>
                    <td className="px-6 py-3 text-text-dim whitespace-nowrap">{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {hasMore && nextCursor && (
            <div className="flex justify-center">
              <a
                href={`/admin/events?cursor=${nextCursor}`}
                className="rounded-lg bg-surface px-4 py-2 text-sm text-text-primary hover:bg-neutral-700 transition"
              >
                Load More
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
