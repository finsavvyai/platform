import { getApiToken } from '@/lib/auth-token';
import { NextResponse, type NextRequest } from 'next/server';

import { API_BASE_URL } from '@/lib/api-config';

type Params = Promise<{ userId: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await params;
    const url = `${API_BASE_URL}/api/agents/team/${userId}/activity${req.nextUrl.search}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch user activity' },
      { status: 500 },
    );
  }
}
