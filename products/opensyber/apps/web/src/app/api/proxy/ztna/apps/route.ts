import { getApiToken } from '@/lib/auth-token';
import { NextResponse, type NextRequest } from 'next/server';

import { API_BASE_URL } from '@/lib/api-config';

export async function GET() {
  return forward('GET', null);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return forward('POST', body);
}

async function forward(method: 'GET' | 'POST', body: string | null) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== null) init.body = body;

    const res = await fetch(`${API_BASE_URL}/api/ztna/apps`, init);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to proxy ZTNA apps' },
      { status: 500 },
    );
  }
}
