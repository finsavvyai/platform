/**
 * Extract TokenForge device-binding headers from an incoming request so
 * they can be forwarded through a Next.js proxy route to the API.
 *
 * The client-side TokenForge interceptor sets these four headers on every
 * outbound `fetch` after the device is bound. Without this forwarding,
 * sensitive routes like `POST /api/instances/*\/secrets` always return
 * `403 device_binding_required`.
 */
const TF_HEADERS = [
  'x-tf-signature',
  'x-tf-nonce',
  'x-tf-timestamp',
  'x-tf-device-id',
] as const;

export function extractTokenForgeHeaders(
  request: Request,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of TF_HEADERS) {
    const value = request.headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}
