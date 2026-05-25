/**
 * Native DBSC transport.
 *
 * Chrome 146+ on platforms with TPM/Secure Enclave manages the
 * keypair itself. The SDK only needs to (a) feature-detect, (b) hand
 * the browser a registration URL via `Sec-Session-Registration`, and
 * (c) get out of the way — the browser handles refresh internally.
 *
 * If detection fails, callers MUST fall back to the Web Crypto path
 * in `./webcrypto.ts`. That fallback is the whole reason we have
 * three transports and a single `bind()` API on top.
 */

export interface DbscDetectionResult {
  /** True if the runtime exposes the Device Bound Session API. */
  supported: boolean;
  /** Reason it was rejected — useful for telemetry. */
  reason?: 'no_navigator' | 'no_dbsc_api' | 'http_only_origin';
}

export function detectNativeDbsc(): DbscDetectionResult {
  if (typeof navigator === 'undefined') return { supported: false, reason: 'no_navigator' };
  // W3C draft exposes `deviceBoundSession`. Chrome's experimental flag
  // ships it on `navigator` once the origin trial is enabled.
  const nav = navigator as Navigator & { deviceBoundSession?: unknown };
  if (typeof nav.deviceBoundSession === 'undefined') {
    return { supported: false, reason: 'no_dbsc_api' };
  }
  // DBSC requires a secure context. localhost is allowed; everything
  // else must be HTTPS.
  if (typeof self !== 'undefined' && (self as { isSecureContext?: boolean }).isSecureContext === false) {
    return { supported: false, reason: 'http_only_origin' };
  }
  return { supported: true };
}

/**
 * Trigger native DBSC by issuing a primer fetch the browser inspects
 * for `Sec-Session-Registration`. The customer's middleware MUST
 * return that header on the response.
 *
 * Returns true when the browser appears to have started its own
 * registration ceremony; returns false to signal "fall back to Web
 * Crypto."
 */
export async function primeNativeDbsc(opts: {
  registerUrl: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<boolean> {
  const detection = detectNativeDbsc();
  if (!detection.supported) return false;
  const fetchFn = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  try {
    const res = await fetchFn(opts.registerUrl, {
      method: 'HEAD',
      credentials: 'include',
    });
    // Browsers that have already started DBSC will surface a feature
    // header; in its absence, we cannot prove the path is wired and
    // fall back rather than risk a silent failure.
    return res.headers.has('Sec-Session-Registration');
  } catch {
    return false;
  }
}
