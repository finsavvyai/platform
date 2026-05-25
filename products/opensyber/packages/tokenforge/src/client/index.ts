import type { TokenForgeConfig } from '../shared/types.js';
import { bindDevice } from './binding.js';
import { clearDeviceKeys, getDeviceKey } from './storage.js';
import { installFetchInterceptor } from './interceptor.js';
import {
  signAction as signActionInternal,
  type ActionPayload,
  type SignActionResult,
} from './action-signer.js';

/**
 * TokenForge Client SDK — main entry point.
 *
 * Usage:
 *   const tf = createTokenForge({ apiBase: '/api', getSessionId: () => sid });
 *   await tf.init();
 */
export class TokenForge {
  private config: TokenForgeConfig;
  private deviceId: string | null = null;
  private keyPair: CryptoKeyPair | null = null;
  private bound = false;
  private cleanupInterceptor: (() => void) | null = null;

  constructor(config: TokenForgeConfig) {
    this.config = config;
  }

  /**
   * Initialize — call after user authenticates.
   * Generates keypair if needed, binds to session, installs interceptor.
   */
  async init(): Promise<void> {
    const sessionId = this.config.getSessionId();
    if (!sessionId) return;

    // Check if Web Crypto is available
    if (!crypto?.subtle) {
      console.warn('TokenForge: Web Crypto API not available, running in degraded mode');
      return;
    }

    try {
      const result = await bindDevice(this.config.apiBase, sessionId);
      this.deviceId = result.deviceId;
      // ECDSA path stores the keyPair; WebAuthn path keeps the credential on
      // the authenticator (signed via navigator.credentials.get on demand).
      this.keyPair = result.type === 'ecdsa' ? result.keyPair : null;
      this.bound = true;

      this.config.onDeviceBound?.(this.deviceId);

      if (this.config.autoIntercept !== false) {
        this.cleanupInterceptor = installFetchInterceptor(
          this.config,
          async () => {
            if (!this.keyPair || !this.deviceId) return null;
            const sid = this.config.getSessionId();
            if (!sid) return null;
            return {
              privateKey: this.keyPair.privateKey,
              sessionId: sid,
              deviceId: this.deviceId,
            };
          },
        );
      }
    } catch (err) {
      console.error('TokenForge: Binding failed', err);
      // Graceful degradation — app continues without device binding
    }
  }

  /**
   * Manually sign a request (if autoIntercept is false).
   */
  async signRequest(request: Request): Promise<Request> {
    if (!this.keyPair || !this.deviceId) return request;

    const { signChallenge, generateNonce } = await import('./signer.js');
    const sessionId = this.config.getSessionId();
    if (!sessionId) return request;

    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await signChallenge(
      this.keyPair.privateKey,
      sessionId,
      nonce,
      timestamp,
    );
    const signature = typeof result === 'string' ? result : result.signature;

    const headers = new Headers(request.headers);
    headers.set(this.config.headers?.signature || 'X-TF-Signature', signature);
    headers.set(this.config.headers?.nonce || 'X-TF-Nonce', nonce);
    headers.set(
      this.config.headers?.timestamp || 'X-TF-Timestamp',
      timestamp.toString(),
    );
    headers.set(
      this.config.headers?.deviceId || 'X-TF-Device-ID',
      this.deviceId,
    );

    return new Request(request, { headers });
  }

  /** @returns The current device ID, or null if not yet bound. */
  getDeviceId(): string | null {
    return this.deviceId;
  }

  /** @returns Whether the device has been successfully bound to the session. */
  isBound(): boolean {
    return this.bound;
  }

  /** Clear stored keys and unbind the device. Removes the fetch interceptor. */
  async clearKeys(): Promise<void> {
    this.cleanupInterceptor?.();
    this.cleanupInterceptor = null;
    this.keyPair = null;
    this.deviceId = null;
    this.bound = false;
    await clearDeviceKeys();
  }

  /** Clear existing binding and re-initialize (generate new keypair + bind). */
  async rebind(): Promise<void> {
    await this.clearKeys();
    await this.init();
  }

  /**
   * Sign a high-trust action (checkout, password change, admin grant…) with
   * the device-bound private key. Returns a compact JWS the server verifies
   * via `verifyCompactJws` + `actionHash` claim match.
   *
   * @throws when the device is not yet bound (call `init()` first).
   */
  async signAction(
    payload: ActionPayload,
    options: { ttlSeconds?: number; kid?: string; tlsExporter?: string } = {},
  ): Promise<SignActionResult> {
    if (!this.keyPair || !this.bound) {
      throw new Error('TokenForge.signAction: device not bound — call init() first');
    }
    const sessionId = this.config.getSessionId();
    if (!sessionId) {
      throw new Error('TokenForge.signAction: no sessionId from getSessionId()');
    }
    return signActionInternal(payload, {
      privateKey: this.keyPair.privateKey,
      sessionId,
      kid: options.kid,
      ttlSeconds: options.ttlSeconds,
      tlsExporter: options.tlsExporter,
    });
  }
}

/**
 * Factory function to create a TokenForge instance.
 */
export function createTokenForge(config: TokenForgeConfig): TokenForge {
  return new TokenForge(config);
}
