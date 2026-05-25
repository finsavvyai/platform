/**
 * Server-to-server HTTP client for TokenForge `/v1/sessions/*`.
 *
 * Holds the `X-TokenForge-Key` API key. NEVER instantiated in browser
 * code — that's why this lives in `@tokenforge/hono`, not
 * `@tokenforge/browser`.
 */

import type { BindingClass } from '@tokenforge/protocol';
import {
  TokenForgeError,
  type TfRefreshResponse,
  type TfRegisterResponse,
} from './types.js';

export interface TokenForgeClientOptions {
  appId: string;
  apiKey: string;
  apiBase: string;
  fetchImpl?: typeof globalThis.fetch;
}

export interface RegisterInput {
  subject: string;
  metadata?: Record<string, unknown>;
  public_key_jwk: JsonWebKey;
  binding_class: BindingClass;
  client_ip?: string;
  user_agent?: string;
}

export class TokenForgeClient {
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly opts: TokenForgeClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async register(input: RegisterInput): Promise<TfRegisterResponse> {
    const res = await this.fetchImpl(`${this.opts.apiBase}/v1/sessions/register`, {
      method: 'POST',
      headers: {
        'X-TokenForge-Key': this.opts.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...input, app_id: this.opts.appId }),
    });
    if (!res.ok) throw new TokenForgeError(`register_failed_${res.status}`, res.status);
    return (await res.json()) as TfRegisterResponse;
  }

  async refresh(dpop: string): Promise<TfRefreshResponse> {
    const res = await this.fetchImpl(`${this.opts.apiBase}/v1/sessions/refresh`, {
      method: 'POST',
      headers: { 'X-TokenForge-Key': this.opts.apiKey, DPoP: dpop },
    });
    if (!res.ok) throw new TokenForgeError(`refresh_failed_${res.status}`, res.status);
    return (await res.json()) as TfRefreshResponse;
  }

  async revoke(sessionId: string, reason?: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.opts.apiBase}/v1/sessions/${encodeURIComponent(sessionId)}/revoke`,
      {
        method: 'POST',
        headers: {
          'X-TokenForge-Key': this.opts.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    );
    if (!res.ok) throw new TokenForgeError(`revoke_failed_${res.status}`, res.status);
  }
}
