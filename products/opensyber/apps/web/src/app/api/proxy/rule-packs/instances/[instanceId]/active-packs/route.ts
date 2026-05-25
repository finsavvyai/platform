import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ instanceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { instanceId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(
      `/api/rule-packs/instances/${instanceId}/active-packs`,
      { token },
    );
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch active packs' },
      { status: 500 },
    );
  }
}
