import type { TokenForgeConfig } from '../shared/types.js';
import { signChallenge, generateNonce, TF_PROTOCOL_VERSION } from './signer.js';

/**
 * Install a fetch interceptor that automatically signs all requests
 * to the protected API with TokenForge headers.
 *
 * Application code continues to use fetch() normally.
 */
export function installFetchInterceptor(
  config: TokenForgeConfig,
  getSigningMaterial: () => Promise<{
    privateKey: CryptoKey;
    sessionId: string;
    deviceId: string;
  } | null>,
): () => void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (!shouldIntercept(url, config)) {
      return originalFetch(input, init);
    }

    const material = await getSigningMaterial();
    if (!material) {
      return originalFetch(input, init);
    }

    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    const method = (init?.method ?? 'GET').toUpperCase();
    const parsedUrl = url.startsWith('http') ? new URL(url) : new URL(url, location.origin);
    const path = parsedUrl.pathname;
    const body = await extractBody(input, init);

    const result = await signChallenge(
      material.privateKey,
      material.sessionId,
      nonce,
      timestamp,
      method,
      path,
      body,
    );

    const headers = new Headers(init?.headers);
    headers.set(config.headers?.signature || 'X-TF-Signature', result.signature);
    headers.set(config.headers?.nonce || 'X-TF-Nonce', nonce);
    headers.set(
      config.headers?.timestamp || 'X-TF-Timestamp',
      timestamp.toString(),
    );
    headers.set(
      config.headers?.deviceId || 'X-TF-Device-ID',
      material.deviceId,
    );
    headers.set('X-TF-Version', TF_PROTOCOL_VERSION);
    headers.set('X-TF-Body-Hash', result.bodyHash);

    const response = await originalFetch(input, { ...init, headers });

    if (response.status === 403) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        body &&
        typeof body === 'object' &&
        'action' in body &&
        body.action === 'step_up_required'
      ) {
        config.onStepUpRequired?.(
          ('reason' in body ? String(body.reason) : '') || 'trust_score_low',
        );
      }
    }

    if (response.status === 401) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        body &&
        typeof body === 'object' &&
        'action' in body &&
        body.action === 'session_revoked'
      ) {
        config.onSessionRevoked?.();
      }
    }

    return response;
  };

  // Return cleanup function
  return () => {
    window.fetch = originalFetch;
  };
}

/**
 * Extract the body as a string from the fetch arguments.
 * For streaming bodies or non-string types, returns null (hashed as empty).
 */
async function extractBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<string | null> {
  const raw = init?.body ?? (input instanceof Request ? input.body : null);
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw);
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  // ReadableStream or FormData — cannot consume without side effects
  return null;
}

function shouldIntercept(url: string, config: TokenForgeConfig): boolean {
  // Only intercept requests to the API base
  if (!url.startsWith(config.apiBase) && !url.startsWith('/')) {
    return false;
  }

  // Skip excluded paths
  if (config.skipPaths) {
    const path = url.startsWith('http')
      ? new URL(url).pathname
      : url;
    for (const skip of config.skipPaths) {
      if (skip.endsWith('*')) {
        if (path.startsWith(skip.slice(0, -1))) return false;
      } else if (path === skip) {
        return false;
      }
    }
  }

  return true;
}
