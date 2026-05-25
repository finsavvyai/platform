import { getApiToken } from '@/lib/auth-token';
import { NextResponse, type NextRequest } from 'next/server';

import { API_BASE_URL } from '@/lib/api-config';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.text();
  return forward(`/${encodeURIComponent(id)}`, 'PATCH', body);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return forward(`/${encodeURIComponent(id)}`, 'DELETE', null);
}

async function forward(suffix: string, method: 'PATCH' | 'DELETE', body: string | null) {
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

    const res = await fetch(`${API_BASE_URL}/api/ztna/apps${suffix}`, init);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to proxy ZTNA app' },
      { status: 500 },
    );
  }
}
