import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Cache for 60s at the client (private) and 30s at the edge (s-maxage),
 * allowing stale content for up to 5 minutes while revalidating in the
 * background. Chart data isn't real-time-critical — this cuts D1 load
 * dramatically for users who refresh the dashboard frequently.
 */
const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=60, s-maxage=30, stale-while-revalidate=300',
  'CDN-Cache-Control': 'max-age=30, stale-while-revalidate=300',
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [dashboard, scoreHistory] = await Promise.allSettled([
      apiClient<{ dashboard: { score: { overall: number }; recentEvents: unknown[] } }>(
        `/api/security/instances/${id}/dashboard`,
        { token },
      ),
      apiClient<{ data: { date: string; score: number }[] }>(
        `/api/security/instances/${id}/score-history?period=30d`,
        { token },
      ),
    ]);

    const events =
      dashboard.status === 'fulfilled'
        ? dashboard.value.dashboard.recentEvents
        : [];

    const severityCounts: Record<string, number> = {};
    for (const e of events as unknown[]) {
      if (typeof e === 'object' && e !== null && 'severity' in e) {
        const sev = String((e as Record<string, unknown>).severity);
        severityCounts[sev] = (severityCounts[sev] ?? 0) + 1;
      }
    }

    return NextResponse.json(
      {
        data: {
          threatTrend: [],
          severities: Object.entries(severityCounts).map(([severity, count]) => ({
            severity,
            count,
          })),
          scoreHistory:
            scoreHistory.status === 'fulfilled' ? scoreHistory.value.data : [],
          alertVolume: [],
        },
      },
      { headers: CACHE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { message: 'Failed to fetch charts' },
      { status: 500 },
    );
  }
}
