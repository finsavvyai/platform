import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; policyId: string }> },
) {
  try {
    const { id, policyId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = await apiClient(`/api/security/instances/${id}/policies/${policyId}`, {
      method: 'PATCH', token, body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; policyId: string }> },
) {
  try {
    const { id, policyId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(`/api/security/instances/${id}/policies/${policyId}`, {
      method: 'DELETE', token,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
