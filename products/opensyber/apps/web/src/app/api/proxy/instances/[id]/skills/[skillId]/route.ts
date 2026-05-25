import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> },
) {
  try {
    const { id, skillId } = await params;
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const data = await apiClient(`/api/instances/${id}/skills/${skillId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to update skill' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> },
) {
  try {
    const { id, skillId } = await params;
    const token = await getApiToken();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await apiClient(`/api/instances/${id}/skills/${skillId}`, {
      method: 'DELETE',
      token,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to uninstall' },
      { status: 500 },
    );
  }
}
