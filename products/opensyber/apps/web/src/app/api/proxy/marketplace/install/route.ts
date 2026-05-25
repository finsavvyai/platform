import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { skillId, instanceId } = body;

    if (!skillId || !instanceId) {
      return NextResponse.json({ error: 'skillId and instanceId required' }, { status: 400 });
    }

    const data = await apiClient(`/api/marketplace/${skillId}/install`, {
      token,
      method: 'POST',
      body: JSON.stringify({ instanceId }),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Install failed' },
      { status: 500 },
    );
  }
}
