import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const qs = url.search; // preserves ?format=csv&from=...&to=...
    const data = await apiClient(`/api/security/instances/${id}/audit/export${qs}`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to export audit log' },
      { status: 500 },
    );
  }
}
