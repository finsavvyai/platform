import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await apiClient('/api/enterprise/contact', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed' }, { status: 500 },
    );
  }
}
