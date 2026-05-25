/**
 * Web Crypto fallback transport — universal path that works in every
 * modern browser. Generates a non-extractable ECDSA P-256 keypair,
 * exports the public half as JWK, and POSTs to the customer's
 * registerUrl which proxies to TokenForge `/v1/sessions/register`.
 */

import type { BoundSessionRecord, RegisterResponse } from '../types.js';

export interface BindArgs {
  registerUrl: string;
  subject: string;
  metadata?: Record<string, unknown>;
  fetchImpl?: typeof globalThis.fetch;
}

/**
 * One-shot registration flow.
 *
 * Generates the keypair `extractable=true` so the public JWK can be
 * exported, then re-imports the private half as `extractable=false`
 * so the live signing key is locked to the browser key store.
 */
export async function bindViaWebCrypto(args: BindArgs): Promise<BoundSessionRecord> {
  const { privateKey, publicJwk } = await generateMatchingKeypair();
  const fetchFn = args.fetchImpl ?? globalThis.fetch;
  const res = await fetchFn(args.registerUrl, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: args.subject,
      metadata: args.metadata,
      public_key_jwk: publicJwk,
      binding_class: 'webcrypto',
    }),
  });
  if (!res.ok) throw new RegisterError(`register_failed_${res.status}`, res.status);
  const json = (await res.json()) as RegisterResponse;
  return {
    sessionId: json.session_id,
    refreshUrl: json.refresh_url,
    lastChallenge: json.challenge,
    publicKeyJwk: publicJwk,
    privateKey,
    bindingClass: 'webcrypto',
    createdAt: new Date().toISOString(),
  };
}

async function generateMatchingKeypair(): Promise<{
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
}> {
  // Generate as extractable=true so we can export the public JWK,
  // then re-import the private half as non-extractable so the live
  // signing key is locked to the browser key store.
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  return {
    privateKey,
    publicJwk: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y, alg: 'ES256', use: 'sig' },
  };
}

export class RegisterError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'RegisterError';
  }
}
