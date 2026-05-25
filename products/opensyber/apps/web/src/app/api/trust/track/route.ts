import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await apiClient<{ data: { id: string } }>('/api/trust/events', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'User-Agent': request.headers.get('user-agent') ?? '',
        'CF-IPCountry': request.headers.get('cf-ipcountry') ?? '',
      },
      timeoutMs: 5_000,
    });
    return NextResponse.json(data, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to track trust event' },
      { status: 400 },
    );
  }
}
