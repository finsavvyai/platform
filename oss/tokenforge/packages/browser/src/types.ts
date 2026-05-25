/**
 * Public + internal types for `@tokenforge/browser`.
 */

export type BindingClass = 'native_dbsc' | 'webauthn' | 'webcrypto';

export interface BoundSessionRecord {
  sessionId: string;
  refreshUrl: string;
  lastChallenge: string;
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
  bindingClass: BindingClass;
  createdAt: string;
}

export interface RegisterResponse {
  session_id: string;
  refresh_url: string;
  challenge: string;
}

export interface TokenForgeOptions {
  /**
   * Customer-side endpoint that proxies to TokenForge /v1/sessions/register.
   * Phase 5's `@tokenforge/hono` middleware terminates this path. The SDK
   * never holds the server API key.
   */
  registerUrl: string;
  /** Override storage; defaults to IndexedDB in browsers, memory elsewhere. */
  storage?: BindingStorage;
  /** Override fetch (for testing). */
  fetch?: typeof globalThis.fetch;
  /** Auto-install the fetch interceptor on construction. Default: true. */
  installInterceptor?: boolean;
  /** Try native DBSC first, fall back to Web Crypto. Default: true. */
  preferDbsc?: boolean;
}

export interface BindArgs {
  subject: string;
  metadata?: Record<string, unknown>;
}

export interface BindingStorage {
  putSession(record: BoundSessionRecord): Promise<void>;
  getSession(): Promise<BoundSessionRecord | null>;
  updateChallenge(challenge: string): Promise<void>;
  clear(): Promise<void>;
}

export type TokenForgeEvent =
  | { type: 'bound'; sessionId: string }
  | { type: 'refreshed'; sessionId: string; nextChallenge: string }
  | { type: 'step_up_required'; signals: string[] }
  | { type: 'session_revoked'; reason: string }
  | { type: 'binding_lost'; error: unknown };

export type TokenForgeListener = (event: TokenForgeEvent) => void;
