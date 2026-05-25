import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { getOrgIdFromRequest } from '@/lib/org-context';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = await getApiToken();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = getOrgIdFromRequest(request);
    const data = await apiClient(`/api/instances/${id}/restart`, {
      method: 'POST',
      token,
      orgId,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to restart' },
      { status: 500 },
    );
  }
}
