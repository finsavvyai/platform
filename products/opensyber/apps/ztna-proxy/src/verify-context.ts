import type { TfRequestContext } from '@opensyber/tokenforge/server/internal';

/**
 * Build a normalized TokenForge request context from an incoming Worker
 * request. The proxy never has its own session — it relies on TokenForge
 * headers (X-TF-*) sent by the upstream app's client SDK.
 */
export function buildVerifyContext(
  req: Request,
  pathname: string,
  userId: string | null,
  sessionId: string | null,
): TfRequestContext {
  return {
    path: pathname,
    method: req.method,
    userId,
    sessionId,
    ipAddress: req.headers.get('cf-connecting-ip') ?? '',
    countryCode: req.headers.get('cf-ipcountry') ?? '',
    userAgent: req.headers.get('user-agent') ?? '',
    headers: {
      signature: req.headers.get('x-tf-signature'),
      nonce: req.headers.get('x-tf-nonce'),
      timestamp: req.headers.get('x-tf-timestamp'),
      deviceId: req.headers.get('x-tf-device-id'),
    },
  };
}
