import { generateDeviceKeyPair, exportPublicKey } from './crypto.js';
import { storeDeviceKey, getDeviceKey } from './storage.js';
import { bindDeviceWebAuthn } from './webauthn.js';
import type { DeviceMetadata } from '../shared/types-internal.js';

/** Optional per-call options for {@link bindDevice}. */
export interface BindDeviceOptions {
  /** Bind algorithm preference. Default 'ecdsa' (existing behavior). */
  prefer?: 'webauthn' | 'ecdsa';
  /** Required when prefer === 'webauthn'. */
  userId?: string;
  /** Required when prefer === 'webauthn'. */
  displayName?: string;
}

/** Result of a successful bind. WebAuthn binds have no in-memory keypair. */
export type BindDeviceResult =
  | { type: 'ecdsa'; deviceId: string; keyPair: CryptoKeyPair }
  | { type: 'webauthn'; deviceId: string; credentialId: string };

/**
 * Complete device binding flow — called once after authentication.
 *
 * 1. Check if we already have a valid key for this session
 * 2. If not, generate new keypair (or invoke WebAuthn ceremony)
 * 3. Send public key / attestation to server to bind to session
 * 4. Server stores public key and returns device ID
 * 5. Store keypair + device ID locally (ECDSA path only — WebAuthn lives
 *    on the authenticator)
 */
export async function bindDevice(
  apiBase: string,
  sessionId: string,
  options?: BindDeviceOptions,
): Promise<BindDeviceResult> {
  const prefer = options?.prefer ?? 'ecdsa';

  if (prefer === 'webauthn') {
    if (!options?.userId || !options?.displayName) {
      throw new Error('bindDevice(webauthn): userId and displayName are required');
    }
    const { deviceId, credentialId } = await bindDeviceWebAuthn(
      apiBase, sessionId, options.userId, options.displayName,
    );
    return { type: 'webauthn', deviceId, credentialId };
  }

  // ── ECDSA path (unchanged) ──
  const existing = await getDeviceKey();
  if (existing && existing.sessionId === sessionId) {
    return { type: 'ecdsa', deviceId: existing.deviceId, keyPair: existing.keyPair };
  }

  const keyPair = await generateDeviceKeyPair();
  const publicKeyJwk = await exportPublicKey(keyPair);

  const metadata: DeviceMetadata = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorDepth: screen.colorDepth,
  };

  const response = await fetch(`${apiBase}/api/tf/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      publicKey: publicKeyJwk,
      sessionId,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`TokenForge binding failed: ${response.status}`);
  }

  const { deviceId } = (await response.json()) as { deviceId: string };

  await storeDeviceKey({
    deviceId,
    keyPair,
    createdAt: Date.now(),
    sessionId,
  });

  return { type: 'ecdsa', deviceId, keyPair };
}
