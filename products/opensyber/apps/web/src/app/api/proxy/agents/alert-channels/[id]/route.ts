import { getApiToken } from '@/lib/auth-token';
import { getOrgIdFromRequest } from '@/lib/org-context';
import { NextResponse, type NextRequest } from 'next/server';

import { API_BASE_URL } from '@/lib/api-config';

type Params = Promise<{ id: string }>;

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = getOrgIdFromRequest(req);
    const { id } = await params;
    const body = await req.json();
    const url = `${API_BASE_URL}/api/alert-channels/${id}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(orgId ? { 'X-Org-Id': orgId } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to update alert channel' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = getOrgIdFromRequest(req);
    const { id } = await params;
    const url = `${API_BASE_URL}/api/alert-channels/${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(orgId ? { 'X-Org-Id': orgId } : {}),
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to delete alert channel' },
      { status: 500 },
    );
  }
}
