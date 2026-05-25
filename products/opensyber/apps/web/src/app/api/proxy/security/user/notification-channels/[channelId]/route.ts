import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(`/api/security/user/notification-channels/${channelId}`, {
      method: 'DELETE', token,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
