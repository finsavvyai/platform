import { getApiToken } from '@/lib/auth-token';
import { NextResponse } from 'next/server';

import { API_BASE_URL } from '@/lib/api-config';

export async function GET() {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = `${API_BASE_URL}/api/findings/unified/summary`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch unified summary' },
      { status: 500 },
    );
  }
}
