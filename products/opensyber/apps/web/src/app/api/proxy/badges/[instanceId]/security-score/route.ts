import { API_BASE_URL } from '@/lib/api-config';

/**
 * Same-origin proxy for the security-score SVG badge.
 *
 * The BadgeEmbed component previews the badge with an <img> tag. Hitting
 * the absolute production API URL cross-origin is fragile: any CSP
 * `img-src` drift, regional deployment, or local dev against
 * `http://localhost:8787` breaks the preview. Proxying through Next.js
 * keeps the preview URL same-origin and always CSP-allowed.
 *
 * Copyable snippets still use the absolute production URL because those
 * get embedded in READMEs hosted on GitHub and must be cross-origin.
 */

// Only allow GET; everything else falls through to Next's default 405.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;

  // Instance IDs are internal identifiers — a conservative allowlist prevents
  // path-traversal or injection attempts against the upstream API URL.
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(instanceId)) {
    return new Response('Invalid instance ID', { status: 400 });
  }

  try {
    const upstream = await fetch(
      `${API_BASE_URL}/api/badges/${instanceId}/security-score`,
      { signal: AbortSignal.timeout(5_000) },
    );

    // Preserve status + body so a 404 stays a 404 rather than silently
    // becoming a broken 200 image.
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'image/svg+xml',
        'Cache-Control':
          upstream.headers.get('Cache-Control') ?? 'public, max-age=300',
      },
    });
  } catch {
    return new Response('Badge unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
