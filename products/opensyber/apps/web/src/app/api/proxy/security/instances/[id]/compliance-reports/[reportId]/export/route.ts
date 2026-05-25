import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

interface Params {
  params: Promise<{ id: string; reportId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id, reportId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const qs = url.search || '?format=csv';
    const data = await apiClient(
      `/api/security/instances/${id}/compliance-reports/${reportId}/export${qs}`,
      { token },
    );
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to export compliance report' },
      { status: 500 },
    );
  }
}
