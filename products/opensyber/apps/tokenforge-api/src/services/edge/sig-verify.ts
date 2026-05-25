/**
 * Edge request signature verifier (Sprint 37 Task 9).
 *
 * Pure helper that accepts BOTH the legacy `X-TF-Signature/Nonce/Timestamp`
 * header triple and the compact-form JWS used by DBSC refresh + action
 * signing, returning a single decision so `edge-verify.ts` does not have
 * to grow two parallel branches.
 *
 *   mode='jws'    — `headers.jws` present and validates against the
 *                   session's public key. `sub` claim must match the
 *                   session id; nonce/timestamp checks are folded into
 *                   the JWS verifier (iat/exp/nonce claims).
 *
 *   mode='legacy' — `headers.signature/nonce/timestamp` present and the
 *                   raw ECDSA signature validates over `${sid}:${nonce}:${ts}`
 *                   with the timestamp inside the 60-second skew window.
 *
 * Resolution: a JWS in the input wins over the legacy triple even if both
 * are supplied — modern path is preferred and guards against header-stuffing
 * downgrade attacks.
 */

import {
  importPublicKey,
  verifySignature,
  verifyCompactJws,
} from '@opensyber/tokenforge/server/internal';

export interface EdgeSigInput {
  signature: string | null;
  nonce: string | null;
  timestamp: string | null;
  /** Optional compact-form JWS (header.payload.signature). */
  jws?: string | null;
}

export interface EdgeSession {
  sessionId: string;
  publicKey: string;
}

export type EdgeSigVerdict =
  | { ok: true; mode: 'legacy' | 'jws' }
  | { ok: false; mode: 'legacy' | 'jws' | 'none'; reason: string };

const TIMESTAMP_SKEW_SECONDS = 60;

export async function verifyEdgeSignature(
  session: EdgeSession,
  input: EdgeSigInput,
  now: number = Math.floor(Date.now() / 1000),
): Promise<EdgeSigVerdict> {
  if (input.jws) {
    return verifyJwsPath(session, input.jws);
  }
  if (input.signature && input.nonce && input.timestamp) {
    return verifyLegacyPath(session, input, now);
  }
  return { ok: false, mode: 'none', reason: 'no_signature_headers' };
}

async function verifyJwsPath(
  session: EdgeSession,
  jws: string,
): Promise<EdgeSigVerdict> {
  const result = await verifyCompactJws(jws, {
    publicKey: session.publicKey,
    maxAgeSeconds: TIMESTAMP_SKEW_SECONDS,
  });
  if (!result.ok) return { ok: false, mode: 'jws', reason: result.reason };
  if (result.claims.sub !== session.sessionId) {
    return { ok: false, mode: 'jws', reason: 'jws_subject_mismatch' };
  }
  return { ok: true, mode: 'jws' };
}

async function verifyLegacyPath(
  session: EdgeSession,
  input: EdgeSigInput,
  now: number,
): Promise<EdgeSigVerdict> {
  const ts = parseInt(input.timestamp ?? '0', 10);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, mode: 'legacy', reason: 'timestamp_invalid' };
  }
  if (Math.abs(now - ts) > TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, mode: 'legacy', reason: 'timestamp_skew' };
  }
  let valid = false;
  try {
    const publicKey = await importPublicKey(session.publicKey);
    const payload = `${session.sessionId}:${input.nonce}:${ts}`;
    valid = await verifySignature(publicKey, input.signature!, payload);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, mode: 'legacy', reason: 'signature_invalid' };
  return { ok: true, mode: 'legacy' };
}
