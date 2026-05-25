import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

/**
 * Fetch the gateway token for an instance the current user owns.
 * Used by ConnectAgentCard to display the pairing token for CLI / MCP /
 * VS Code install instructions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
    }

    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await apiClient<{ data: { instanceId: string; gatewayToken: string } }>(
      `/api/instances/${id}/gateway-token`,
      { token },
    );

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch gateway token';
    const status = message.includes('Not ready') ? 409 : 500;
    return NextResponse.json({ message }, { status });
  }
}
