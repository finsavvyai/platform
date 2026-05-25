/**
 * WebAuthn / FIDO2 client flow — alternative to the ECDSA browser key path.
 *
 * Coexists with the ECDSA flow in binding.ts. Caller opts in via
 * `bindDevice(..., { prefer: 'webauthn' })`. The credential private key is
 * never exposed to JS — it lives on the authenticator (YubiKey, Touch ID,
 * Windows Hello, platform passkey provider).
 *
 * NOTE: WebAuthn signatures are over (authenticatorData || sha256(clientDataJSON)),
 * not the raw `${sessionId}:${nonce}:${timestamp}` payload. The server reconstructs
 * the same expected challenge from session/nonce/timestamp and compares it to
 * the challenge embedded inside clientDataJSON.
 */

export interface WebAuthnBindResult {
  deviceId: string;
  credentialId: string;
}

export interface WebAuthnAssertion {
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
  credentialId: string;
}

/** base64url encode a buffer (no padding, URL-safe alphabet). */
export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** base64url decode to ArrayBuffer. */
export function base64UrlToBuffer(b64url: string): ArrayBuffer {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** SHA-256 → bytes for the WebAuthn challenge derivation. */
async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
}

/**
 * Bind a hardware credential to the active session.
 *
 * Calls navigator.credentials.create with ES256 (alg -7) + EdDSA (alg -8)
 * pubKeyCredParams. Sends the attestation to the server, receives the
 * persisted deviceId.
 */
export async function bindDeviceWebAuthn(
  apiBase: string,
  sessionId: string,
  userId: string,
  displayName: string,
): Promise<WebAuthnBindResult> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn not available in this environment');
  }

  // Server-bound challenge: derived from sessionId so a stolen challenge
  // can't be replayed against another session.
  const challenge = await sha256(`tf-bind:${sessionId}`);

  const userIdBytes = new TextEncoder().encode(userId);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: 'TokenForge' },
    user: { id: userIdBytes, name: userId, displayName },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },  // ES256
      { type: 'public-key', alg: -8 },  // EdDSA
    ],
    authenticatorSelection: { userVerification: 'preferred' },
    timeout: 60_000,
    attestation: 'none',
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error('WebAuthn credential creation cancelled');

  const response = credential.response as AuthenticatorAttestationResponse;
  const body = {
    sessionId,
    userId,
    credentialId: bufferToBase64Url(credential.rawId),
    attestationObject: bufferToBase64Url(response.attestationObject),
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
  };

  const httpResponse = await fetch(`${apiBase}/api/tf/bind/webauthn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!httpResponse.ok) {
    throw new Error(`TokenForge WebAuthn binding failed: ${httpResponse.status}`);
  }

  const { deviceId } = (await httpResponse.json()) as { deviceId: string };
  return { deviceId, credentialId: body.credentialId };
}

/**
 * Sign a per-request challenge with the bound hardware credential.
 *
 * The challenge is `${sessionId}:${nonce}:${timestamp}` — same payload shape
 * as the ECDSA path, but the WebAuthn signature is over
 * (authenticatorData || sha256(clientDataJSON)) where clientDataJSON contains
 * the challenge. The server reconstructs and compares.
 */
export async function signChallengeWebAuthn(
  credentialId: string,
  sessionId: string,
  nonce: string,
  timestamp: number,
): Promise<WebAuthnAssertion> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn not available in this environment');
  }

  const challenge = await sha256(`${sessionId}:${nonce}:${timestamp}`);

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: [
      { id: base64UrlToBuffer(credentialId), type: 'public-key' },
    ],
    userVerification: 'preferred',
    timeout: 60_000,
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!assertion) throw new Error('WebAuthn assertion cancelled');

  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
    signature: bufferToBase64Url(response.signature),
    authenticatorData: bufferToBase64Url(response.authenticatorData),
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    credentialId: bufferToBase64Url(assertion.rawId),
  };
}
