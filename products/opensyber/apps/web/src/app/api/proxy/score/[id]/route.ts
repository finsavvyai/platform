import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api-config';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await fetch(`${API_BASE_URL}/api/score/${id}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Not found' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch score data' }, { status: 500 });
  }
}
