/**
 * Shared protocol types — wire shapes used by `@tokenforge/api`,
 * `@tokenforge/browser`, and `@tokenforge/hono`.
 */

export const PROTOCOL_VERSION = '0.1.0' as const;

export type BindingClass = 'native_dbsc' | 'webauthn' | 'webcrypto';

export interface SessionRecord {
  sessionId: string;
  appId: string;
  subjectId: string;
  publicKeyJwk: JsonWebKey;
  bindingClass: BindingClass;
  origin: string;
}

export interface RegisterRequest {
  app_id: string;
  subject: string;
  subject_metadata?: Record<string, unknown>;
  public_key_jwk: JsonWebKey;
  binding_class: BindingClass;
  attestation?: string;
  client_ip: string;
  user_agent: string;
}

export interface CookieDescriptor {
  name: string;
  value: string;
  max_age: number;
  attributes: string;
}

export interface RegisterResponse {
  session_id: string;
  short_cookie: CookieDescriptor;
  long_cookie: CookieDescriptor;
  refresh_url: string;
  challenge: string;
}

export interface RefreshAction {
  signals: string[];
  action: 'allow' | 'step_up' | 'block';
}
