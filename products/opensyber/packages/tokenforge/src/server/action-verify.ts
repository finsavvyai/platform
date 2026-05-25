/**
 * Server-side action-signing verifier (Sprint 39).
 *
 * Wraps `verifyCompactJws` with two extra invariants the client SDK
 * promises:
 *   1. The JWS `action` claim equals the `expectedAction` the route
 *      handler is enforcing (e.g. POST /checkout asserts "checkout").
 *   2. The JWS `actionHash` claim equals the SHA-256 of the
 *      canonicalized request body. This binds the signature to the
 *      payload — replaying the same JWS against a different body
 *      (different recipient, amount, etc.) fails.
 *
 * Replay prevention against the SAME body is the caller's
 * responsibility: they should pass `claims.nonce` through
 * `consumeChallenge` (server/dbsc-challenge.ts) so a second submission
 * of the same JWS is rejected even within the maxAgeSeconds window.
 */

import { verifyCompactJws } from './jws-verify.js';
import type { JwsClaims } from './jws-verify.js';
import { hashActionPayload } from '../shared/action-hash.js';

export interface VerifyActionOptions {
  /** Bound device public key (JWK JSON or PEM SPKI). */
  publicKey: string;
  /** Action verb the route asserts (must equal claims.action). */
  expectedAction: string;
  /** Optional request body — when present, must hash to claims.actionHash. */
  body?: Record<string, unknown> | null;
  /** Maximum age for the JWS in seconds. Default 60. */
  maxAgeSeconds?: number;
  /** Override clock for tests. */
  now?: Date;
  /**
   * RFC 9266 TLS exporter material (hex) extracted from the active TLS
   * connection by the runtime. When provided, claims.tlsExporter MUST
   * match it — protects against replay across a different TLS session.
   * Omit on workerd or any runtime that doesn't expose exporter
   * material; the server emits Sec-TF-Channel-Bound: 0 in that case
   * via the route handler.
   */
  expectedTlsExporter?: string;
  /**
   * If true, reject when claims.tlsExporter is absent. Use this on
   * sensitive routes when running on a runtime that *does* expose the
   * exporter — a missing claim then indicates the client signed
   * without binding the TLS channel.
   */
  requireTlsExporter?: boolean;
}

export type VerifyActionResult =
  | { ok: true; claims: JwsClaims; protectedHeader: Record<string, unknown> }
  | { ok: false; reason: string };

export async function verifyAction(
  jws: string,
  opts: VerifyActionOptions,
): Promise<VerifyActionResult> {
  const inner = await verifyCompactJws(jws, {
    publicKey: opts.publicKey,
    maxAgeSeconds: opts.maxAgeSeconds,
    now: opts.now,
  });
  if (!inner.ok) return inner;

  if (inner.claims.action !== opts.expectedAction) {
    return { ok: false, reason: 'action_mismatch' };
  }

  if (opts.body !== undefined && opts.body !== null) {
    const expectedHash = await hashActionPayload(opts.body);
    if (inner.claims.actionHash !== expectedHash) {
      return { ok: false, reason: 'action_hash_mismatch' };
    }
  }

  if (opts.expectedTlsExporter !== undefined) {
    if (inner.claims.tlsExporter !== opts.expectedTlsExporter) {
      return { ok: false, reason: 'signature_channel_mismatch' };
    }
  } else if (opts.requireTlsExporter && !inner.claims.tlsExporter) {
    return { ok: false, reason: 'tls_exporter_missing' };
  }

  return inner;
}
