import type { ZtnaApp } from './types.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Forward an inbound request to the configured upstream origin.
 * Strips TokenForge-specific headers before forwarding so the upstream app
 * never sees raw verification material. Adds X-Forwarded-* identity headers
 * so the upstream can attribute the request to the verified user.
 */
export async function forwardToUpstream(
  req: Request,
  app: ZtnaApp,
  identity: { userId: string; deviceId: string; trustScore: number },
): Promise<Response> {
  if (WRITE_METHODS.has(req.method) && !app.forwardWriteMethods) {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Write methods disabled for this app' }),
      { status: 405, headers: { 'content-type': 'application/json' } },
    );
  }

  const inboundUrl = new URL(req.url);
  const upstream = new URL(app.upstream);
  upstream.pathname = inboundUrl.pathname;
  upstream.search = inboundUrl.search;

  const fwdHeaders = new Headers(req.headers);
  // Strip TokenForge headers — never leak verification material to upstream.
  fwdHeaders.delete('x-tf-signature');
  fwdHeaders.delete('x-tf-nonce');
  fwdHeaders.delete('x-tf-timestamp');
  fwdHeaders.delete('x-tf-device-id');

  // Attach verified identity for upstream attribution.
  fwdHeaders.set('x-forwarded-user', identity.userId);
  fwdHeaders.set('x-forwarded-device', identity.deviceId);
  fwdHeaders.set('x-forwarded-trust-score', String(identity.trustScore));
  fwdHeaders.set('host', upstream.host);

  const init: RequestInit = {
    method: req.method,
    headers: fwdHeaders,
    redirect: 'manual',
  };

  if (WRITE_METHODS.has(req.method)) {
    init.body = req.body;
  }

  return fetch(upstream.toString(), init);
}
