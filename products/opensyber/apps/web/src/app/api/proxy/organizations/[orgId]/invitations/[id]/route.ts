import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ orgId: string; id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(`/api/organizations/${orgId}/invitations/${id}`, {
      method: 'DELETE', token, orgId,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed' }, { status: 500 },
    );
  }
}
