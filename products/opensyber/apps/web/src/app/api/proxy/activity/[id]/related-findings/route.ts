import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(`/api/activity/${id}/related-findings`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch related findings' },
      { status: 500 },
    );
  }
}
