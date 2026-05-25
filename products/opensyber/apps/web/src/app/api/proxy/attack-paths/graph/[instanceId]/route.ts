import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { getOrgIdFromRequest } from '@/lib/org-context';

/**
 * GET /api/proxy/attack-paths/graph/:instanceId
 *
 * Proxies the AttackGraph3D-ready nodes+edges payload from the backend API,
 * forwarding the caller's Auth.js token and active org context.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ instanceId: string }> },
) {
  try {
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instanceId } = await context.params;
    if (!instanceId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'instanceId required' },
        { status: 400 },
      );
    }

    const orgId = getOrgIdFromRequest(request);
    const data = await apiClient(`/api/attack-paths/graph/${encodeURIComponent(instanceId)}`, {
      method: 'GET',
      token,
      orgId,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        message:
          err instanceof Error ? err.message : 'Failed to fetch attack graph',
      },
      { status: 500 },
    );
  }
}
