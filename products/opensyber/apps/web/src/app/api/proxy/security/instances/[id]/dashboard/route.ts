import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Thin client-side proxy for the security dashboard aggregate.
 *
 * Created because the onboarding wizard's StepConnect polls this URL
 * from the browser to detect the first event the user's CLI emits.
 * Server components already call `/api/security/instances/:id/dashboard`
 * directly via apiClient, so this file only exists to expose the same
 * endpoint to client-side fetches — it doesn't do any additional work.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await apiClient(`/api/security/instances/${id}/dashboard`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch dashboard' },
      { status: 500 },
    );
  }
}
