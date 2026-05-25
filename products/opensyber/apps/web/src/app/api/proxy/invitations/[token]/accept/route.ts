import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token: inviteToken } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient(`/api/organizations/invitations/${inviteToken}/accept`, {
      method: 'POST', token,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept invitation';
    const status = message.includes('expired') ? 410 : message.includes('already') ? 409 : 500;
    return NextResponse.json({ message }, { status });
  }
}
