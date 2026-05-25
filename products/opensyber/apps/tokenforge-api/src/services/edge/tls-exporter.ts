/**
 * TLS exporter (RFC 9266) extraction for the edge runtime.
 *
 * Cloudflare's workerd does not expose TLS exporter material, so when
 * tokenforge-api runs on workerd this helper always returns null and
 * the route emits `Sec-TF-Channel-Bound: 0`. On self-hosted deployments
 * a fronting proxy (Caddy / nginx / Envoy) can attach an
 * `X-TF-Channel-Exporter: <hex>` header derived from the live TLS
 * connection's exporter; the helper validates the hex shape and
 * returns the value, letting `verifyAction` match it against
 * `claims.tlsExporter` to bind the JWS to a specific TLS session.
 *
 * Spec: RFC 9266 (Channel Bindings for TLS 1.3).
 */
const HEADER_NAME = 'X-TF-Channel-Exporter';
const HEX_RE = /^[0-9a-fA-F]+$/;
const MIN_HEX_LEN = 32; // 16 bytes minimum (per RFC 9266 §3 export length requirements)
const MAX_HEX_LEN = 256; // 128 bytes — guard against header bloat / OOM probes

export interface TlsExporterReadResult {
  /** Hex-encoded exporter material, or null when absent / invalid. */
  exporter: string | null;
  /** Header value for `Sec-TF-Channel-Bound`: '1' bound, '0' unbound. */
  channelBoundHeader: '0' | '1';
}

/**
 * Read and validate the TLS exporter header from a request. Validation:
 *   - non-empty
 *   - hex chars only
 *   - length within [MIN_HEX_LEN, MAX_HEX_LEN]
 *
 * Any failure produces { exporter: null, channelBoundHeader: '0' } rather
 * than throwing — the route should treat absence as "not bound" and
 * downgrade per policy, not 500 the request.
 */
export function readTlsExporter(
  headerGetter: (name: string) => string | undefined | null,
): TlsExporterReadResult {
  const raw = headerGetter(HEADER_NAME);
  if (!raw) return { exporter: null, channelBoundHeader: '0' };
  const trimmed = raw.trim();
  if (trimmed.length < MIN_HEX_LEN || trimmed.length > MAX_HEX_LEN) {
    return { exporter: null, channelBoundHeader: '0' };
  }
  if (!HEX_RE.test(trimmed)) {
    return { exporter: null, channelBoundHeader: '0' };
  }
  return { exporter: trimmed.toLowerCase(), channelBoundHeader: '1' };
}

/** Header name the helper reads — exported so middleware can echo it. */
export const TLS_EXPORTER_HEADER = HEADER_NAME;
