import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ bundleId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { bundleId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const data = await apiClient(`/api/bundles/${bundleId}/activate`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to activate bundle' },
      { status: 500 },
    );
  }
}
