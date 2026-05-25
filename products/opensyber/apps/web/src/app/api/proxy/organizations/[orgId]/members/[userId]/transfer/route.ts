import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ orgId: string; userId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { orgId, userId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(`/api/organizations/${orgId}/members/${userId}/transfer`, {
      method: 'POST', token, orgId,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed' }, { status: 500 },
    );
  }
}
