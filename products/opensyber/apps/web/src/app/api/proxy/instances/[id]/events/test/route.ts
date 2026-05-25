import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { API_BASE_URL } from '@/lib/api-config';

/**
 * Sends a synthetic "Hello from CLI" event to the user's instance so
 * the ConnectAgentCard can verify their pairing end-to-end. We fetch
 * the gateway token via the session cookie, then POST to the ingestion
 * endpoint with the same headers the CLI would use. The browser never
 * sees the raw token — it lives only in server memory during this
 * request.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
    }

    const sessionToken = await getApiToken();
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenRes = await fetch(
      `${API_BASE_URL}/api/instances/${id}/gateway-token`,
      { headers: { Authorization: `Bearer ${sessionToken}` } },
    );
    if (!tokenRes.ok) {
      return NextResponse.json(
        { message: 'Could not retrieve gateway token for this instance' },
        { status: tokenRes.status },
      );
    }
    const tokenJson = (await tokenRes.json()) as {
      data: { gatewayToken: string };
    };
    const gatewayToken = tokenJson.data.gatewayToken;

    const testEvent = {
      eventType: 'anomaly_detected',
      severity: 'info' as const,
      details: 'Test event from Connect Agent card — pairing verified',
      timestamp: new Date().toISOString(),
    };

    const ingestRes = await fetch(
      `${API_BASE_URL}/api/instances/${id}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Token': gatewayToken,
          'X-Instance-Id': id,
        },
        body: JSON.stringify(testEvent),
      },
    );

    if (!ingestRes.ok) {
      return NextResponse.json(
        { message: 'Failed to send test event' },
        { status: ingestRes.status },
      );
    }

    const body = (await ingestRes.json()) as { inserted: number };
    return NextResponse.json(
      { inserted: body.inserted, sentAt: new Date().toISOString() },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { message: 'Failed to send test event' },
      { status: 500 },
    );
  }
}
