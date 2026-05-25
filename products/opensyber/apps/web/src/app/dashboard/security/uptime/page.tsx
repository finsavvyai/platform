import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { UptimeChart } from '@/components/dashboard/security/UptimeChart';
import { Activity } from 'lucide-react';

interface UptimeData {
  percentage: number;
  totalChecks: number;
  downChecks: number;
  period: string;
  instanceId: string;
}

interface DowntimeEvent {
  checkedAt: string;
  status: string;
  responseTimeMs: number | null;
}

export default async function UptimePage({
  searchParams,
}: {
  searchParams: Promise<{ instanceId?: string; period?: string }>;
}) {
  const token = await getApiToken();
  const params = await searchParams;
  const instanceId = params.instanceId;
  const period = params.period || '30d';

  if (!token || !instanceId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
        <Activity className="h-12 w-12 mb-4 text-text-dim" />
        <p className="text-lg font-medium">Select an instance to view uptime</p>
        <p className="text-sm text-text-dim mt-1">Uptime tracking begins when your instance starts running</p>
      </div>
    );
  }

  let uptimeData: UptimeData | null = null;
  let downtimeEvents: DowntimeEvent[] = [];

  try {
    const [uptimeRes, eventsRes] = await Promise.all([
      apiClient<{ data: UptimeData }>(`/api/security/uptime/${instanceId}?period=${period}`, { token }),
      apiClient<{ data: DowntimeEvent[] }>(`/api/security/uptime/${instanceId}/events?period=${period}`, { token }),
    ]);
    uptimeData = uptimeRes.data;
    downtimeEvents = eventsRes.data;
  } catch {
    // API not available
  }

  // Generate day-level status for chart (simplified: use percentage to determine overall)
  const dayCount = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component, runs once per request
  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(now - (dayCount - 1 - i) * 86400000);
    return {
      date: date.toISOString().split('T')[0],
      status: ('up' as const),
    };
  });

  // Mark downtime days
  for (const event of downtimeEvents) {
    const eventDate = event.checkedAt.split('T')[0];
    const day = days.find((d) => d.date === eventDate);
    if (day) (day as { date: string; status: string }).status = 'down';
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Uptime Monitoring</h1>

      <UptimeChart
        days={days}
        percentage={uptimeData?.percentage ?? 100}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded border border-border bg-panel/30 p-4">
          <p className="text-xs text-text-secondary">Total Checks</p>
          <p className="text-2xl font-bold">{uptimeData?.totalChecks ?? 0}</p>
        </div>
        <div className="rounded border border-border bg-panel/30 p-4">
          <p className="text-xs text-text-secondary">Down Checks</p>
          <p className="text-2xl font-bold text-red-400">{uptimeData?.downChecks ?? 0}</p>
        </div>
        <div className="rounded border border-border bg-panel/30 p-4">
          <p className="text-xs text-text-secondary">Period</p>
          <p className="text-2xl font-bold">{period}</p>
        </div>
      </div>

      {downtimeEvents.length > 0 && (
        <div className="rounded border border-border bg-panel/30 p-6">
          <h2 className="text-lg font-semibold mb-4">Downtime Events</h2>
          <div className="divide-y divide-neutral-800">
            {downtimeEvents.map((event, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm">{new Date(event.checkedAt).toLocaleString()}</p>
                  <p className="text-xs text-text-secondary capitalize">{event.status}</p>
                </div>
                {event.responseTimeMs && (
                  <span className="text-xs text-text-dim">{event.responseTimeMs}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
