import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  try {
    const { id, key } = await params;
    const token = await getApiToken();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await apiClient(`/api/instances/${id}/secrets/${key}`, {
      method: 'DELETE',
      token,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to delete secret' },
      { status: 500 },
    );
  }
}
