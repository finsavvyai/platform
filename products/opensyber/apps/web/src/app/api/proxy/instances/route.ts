import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { getOrgIdFromRequest } from '@/lib/org-context';

export async function GET(request: Request) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = getOrgIdFromRequest(request);
    const data = await apiClient('/api/instances', { token, orgId });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch instances' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = await getApiToken();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = getOrgIdFromRequest(request);
    const body = await request.json();
    const data = await apiClient('/api/instances', {
      method: 'POST',
      token,
      orgId,
      body: JSON.stringify(body),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to create instance' },
      { status: 500 },
    );
  }
}
