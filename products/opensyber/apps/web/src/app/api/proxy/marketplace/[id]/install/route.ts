import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = await apiClient(`/api/marketplace/${id}/install`, {
      method: 'POST', token, body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed' }, { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = await apiClient(`/api/marketplace/${id}/install`, {
      method: 'DELETE', token, body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed' }, { status: 500 },
    );
  }
}
