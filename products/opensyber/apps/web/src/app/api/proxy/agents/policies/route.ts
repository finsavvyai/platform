import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function GET() {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient('/api/agents/policies', { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch policies' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = await apiClient('/api/agents/policies', {
      method: 'POST', token, body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to create policy' },
      { status: 500 },
    );
  }
}
