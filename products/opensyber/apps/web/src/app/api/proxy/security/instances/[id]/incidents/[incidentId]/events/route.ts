import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; incidentId: string }> },
) {
  try {
    const { id, incidentId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = await apiClient(`/api/security/instances/${id}/incidents/${incidentId}/events`, {
      method: 'POST', token, body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
