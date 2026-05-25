import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

interface Params {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { runId } = await params;
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await apiClient(`/api/detection-tests/runs/${runId}`, { token });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to fetch test run' },
      { status: 500 },
    );
  }
}
