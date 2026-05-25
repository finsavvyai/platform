/**
 * Action signing client SDK (Sprint 39).
 *
 * Produces a compact-form JWS that binds the user's intent to perform a
 * specific action (e.g. `checkout`, `password_change`, `admin_grant`) to
 * their device-bound private key. Server verifies via the existing
 * `verifyCompactJws` (server/jws-verify.ts), then asserts the
 * `action` + `actionHash` claims match the request body.
 *
 * Even if a session cookie is stolen and replayed, the action signature
 * is bound to the action payload — replay against a different action
 * fails actionHash match; replay against the same action fails the
 * one-shot nonce check (caller's responsibility, see action-verify.ts
 * for the server side).
 */

import {
  canonicalizeAction,
  sha256B64Url,
  b64UrlEncodeBytes,
} from '../shared/action-hash.js';

export interface ActionPayload {
  /** Required action verb the server will assert. */
  action: string;
  /** Arbitrary payload fields (e.g. amount, recipient). Hashed into actionHash. */
  [key: string]: unknown;
}

export interface SignActionOptions {
  /** Device-bound private key from the bind ceremony (CryptoKey). */
  privateKey: CryptoKey;
  /** Bound DBSC sessionId — becomes the JWS `sub` claim. */
  sessionId: string;
  /** Public-key id (optional `kid` header). */
  kid?: string;
  /** TTL in seconds (default 60). */
  ttlSeconds?: number;
  /** Test override for clock. */
  now?: () => Date;
  /** Test override for nonce (default: crypto.randomUUID()). */
  nonce?: string;
  /**
   * RFC 9266 TLS channel-binding token (hex). When the runtime exposes
   * the TLS exporter (e.g. self-host node:tls) the caller can mix it
   * into the signed claims so the JWS cannot be replayed across a
   * different TLS connection. workerd does not expose this material;
   * pass undefined and the server emits Sec-TF-Channel-Bound: 0.
   */
  tlsExporter?: string;
}

export interface SignActionResult {
  /** Compact-form JWS string `<header>.<payload>.<signature>`. */
  jws: string;
  /** Server-side hash of the action payload — also embedded in claims. */
  actionHash: string;
  /** Per-call nonce — server should verify it has not been seen before. */
  nonce: string;
}

const DEFAULT_TTL = 60;

export async function signAction(
  payload: ActionPayload,
  opts: SignActionOptions,
): Promise<SignActionResult> {
  if (!payload || typeof payload.action !== 'string' || payload.action.length === 0) {
    throw new Error('signAction: payload.action is required');
  }
  const now = opts.now?.() ?? new Date();
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + (opts.ttlSeconds ?? DEFAULT_TTL);
  const nonce = opts.nonce ?? crypto.randomUUID();

  const actionHash = await sha256B64Url(canonicalizeAction(payload));

  const header: Record<string, unknown> = { alg: 'ES256', typ: 'JWT' };
  if (opts.kid) header.kid = opts.kid;

  const claims: Record<string, unknown> = {
    sub: opts.sessionId,
    iat,
    exp,
    nonce,
    action: payload.action,
    actionHash,
  };
  if (opts.tlsExporter) claims.tlsExporter = opts.tlsExporter;

  const enc = new TextEncoder();
  const headerB64 = b64UrlEncodeBytes(enc.encode(JSON.stringify(header)));
  const claimsB64 = b64UrlEncodeBytes(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    opts.privateKey,
    enc.encode(signingInput),
  );

  const jws = `${signingInput}.${b64UrlEncodeBytes(new Uint8Array(sigBuf))}`;
  return { jws, actionHash, nonce };
}
