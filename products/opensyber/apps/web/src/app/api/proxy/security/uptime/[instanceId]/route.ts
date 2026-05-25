import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { instanceId } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const data = await apiClient(`/api/security/uptime/${instanceId}?period=${period}`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed' }, { status: 500 },
    );
  }
}
