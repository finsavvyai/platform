import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ agentId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { agentId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = await apiClient(`/api/discovery/agents/${agentId}/owner`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to update discovered agent owner' },
      { status: 500 },
    );
  }
}
