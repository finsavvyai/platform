/**
 * Public types for `@tokenforge/hono`.
 */

import type { Context } from 'hono';
import type { BindingClass, CookieDescriptor } from '@tokenforge/protocol';

export interface TokenForgeMiddlewareOptions {
  appId: string;
  apiKey: string;
  /** TokenForge API origin. Default: `https://api.tokenforge.dev`. */
  apiBase?: string;
  /** Path the browser SDK POSTs to register. Default: `/__tokenforge/register`. */
  registerPath?: string;
  /** Path the browser SDK POSTs DPoP refresh to. Default: `/__tokenforge/refresh`. */
  refreshPath?: string;
  /**
   * Resolves the authenticated subject from the request context. Called
   * by the default `/__tokenforge/register` handler. Return `null` to
   * deny — the handler will respond 401.
   */
  onLogin: (c: Context) => Promise<LoginResult | null>;
  /** Called when refresh response says `action: step_up`. Default: `c.json({error:'step_up'},401)`. */
  onStepUp?: (c: Context, signals: string[]) => Response | Promise<Response>;
  /** Called when refresh response says `action: block`. Default: `c.json({error:'revoked'},403)`. */
  onRevoked?: (c: Context) => Response | Promise<Response>;
  /** Override fetch (tests). */
  fetchImpl?: typeof globalThis.fetch;
}

export interface LoginResult {
  subject: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterPassthroughBody {
  public_key_jwk: JsonWebKey;
  binding_class: BindingClass;
  metadata?: Record<string, unknown>;
}

export interface TfRegisterResponse {
  session_id: string;
  short_cookie: CookieDescriptor;
  long_cookie: CookieDescriptor;
  refresh_url: string;
  challenge: string;
}

export interface TfRefreshResponse {
  short_cookie: CookieDescriptor;
  challenge: string;
  signals?: string[];
  action: 'allow' | 'step_up' | 'block';
}

export class TokenForgeError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'TokenForgeError';
  }
}
