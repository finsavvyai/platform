import { getApiToken } from '@/lib/auth-token';
import { NextResponse, type NextRequest } from 'next/server';

import { API_BASE_URL } from '@/lib/api-config';

async function proxyToApi(req: NextRequest, path: string): Promise<NextResponse> {
  const token = await getApiToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url    = `${API_BASE_URL}/api/agents${path}${req.nextUrl.search}`;
  const method = req.method;
  const body   = method !== 'GET' && method !== 'DELETE' ? await req.text() : undefined;

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return proxyToApi(req, '/activity/summary')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return proxyToApi(req, '/activity/sync')
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  return proxyToApi(req, '/activity')
}
