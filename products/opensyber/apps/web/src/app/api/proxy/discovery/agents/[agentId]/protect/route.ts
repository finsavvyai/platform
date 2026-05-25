import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ agentId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { agentId } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const data = await apiClient(`/api/discovery/agents/${agentId}/protect`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to protect discovered agent' },
      { status: 500 },
    );
  }
}
