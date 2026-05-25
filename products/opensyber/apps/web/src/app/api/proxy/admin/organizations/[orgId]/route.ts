import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ orgId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { orgId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const data = await apiClient(
      `/api/admin/organizations/${orgId}${qs ? `?${qs}` : ''}`,
      { method: 'DELETE', token },
    );
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to delete organization' },
      { status: 500 },
    );
  }
}
