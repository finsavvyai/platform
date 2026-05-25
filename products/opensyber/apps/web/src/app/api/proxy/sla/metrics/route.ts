import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function GET(request: Request) {
  try {
    
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') ?? '30';
    const data = await apiClient(`/api/sla/metrics?days=${days}`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
