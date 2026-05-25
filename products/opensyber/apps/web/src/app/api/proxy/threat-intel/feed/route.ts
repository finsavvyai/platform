import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api-config';

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/threat-intel/feed`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'API error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch threat intel feed' }, { status: 500 });
  }
}
