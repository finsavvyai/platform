import { getApiToken } from '@/lib/auth-token';
import { API_BASE_URL } from '@/lib/api-config';

/**
 * Next.js proxy for the streaming AI chat endpoint.
 *
 * The browser opens a normal POST and reads an SSE body. This route
 * attaches the user's OpenSyber JWT server-side so the Anthropic-proxying
 * backend sees an authenticated request, then pipes the upstream SSE bytes
 * back to the browser unchanged.
 */
export const runtime = 'edge';

export async function POST(request: Request): Promise<Response> {
  const token = await getApiToken();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = await request.text();

  const upstream = await fetch(`${API_BASE_URL}/api/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: payload,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => 'Upstream error');
    return new Response(
      JSON.stringify({ error: 'upstream_error', status: upstream.status, detail: text.slice(0, 512) }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
