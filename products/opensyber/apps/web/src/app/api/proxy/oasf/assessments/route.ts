import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function GET(request: Request) {
  try {
    
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ?? '10';
    const data = await apiClient(`/api/oasf/assessments?limit=${limit}`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST() {
  try {
    
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await apiClient('/api/oasf/assessments', {
      method: 'POST', token,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
