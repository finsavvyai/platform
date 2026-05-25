/**
 * `TokenForge` orchestrator — the SDK's public surface.
 *
 * Phase 4 wires up: Web Crypto bind via the customer's registerUrl,
 * IndexedDB-backed storage of the bound session, fetch interceptor
 * that auto-refreshes on 401 + Sec-Session-Challenge, and an event
 * stream for `bound` / `refreshed` / `step_up_required` /
 * `session_revoked` / `binding_lost`.
 */

import type {
  BindArgs,
  BindingStorage,
  BoundSessionRecord,
  TokenForgeEvent,
  TokenForgeListener,
  TokenForgeOptions,
} from '../types.js';
import { defaultStorage } from './storage.js';
import { makeInterceptingFetch } from './interceptor.js';
import { bindViaWebCrypto } from '../transports/webcrypto.js';
import { primeNativeDbsc } from '../transports/dbsc.js';
import { signDpop } from './signer.js';

export class TokenForge {
  private readonly storage: BindingStorage;
  private readonly listeners = new Set<TokenForgeListener>();
  private readonly baseFetch: typeof globalThis.fetch;
  private readonly registerUrl: string;
  private readonly preferDbsc: boolean;
  private originalFetch: typeof globalThis.fetch | null = null;

  constructor(opts: TokenForgeOptions) {
    this.registerUrl = opts.registerUrl;
    this.storage = opts.storage ?? defaultStorage();
    this.baseFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.preferDbsc = opts.preferDbsc ?? true;
    if (opts.installInterceptor !== false) this.installFetch();
  }

  on(listener: TokenForgeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async bind(args: BindArgs): Promise<BoundSessionRecord> {
    if (this.preferDbsc) {
      const native = await primeNativeDbsc({
        registerUrl: this.registerUrl,
        fetchImpl: this.baseFetch,
      });
      if (native) {
        // Browser has taken over: we still record a bookkeeping entry
        // so app code can look up "is the session bound?" without
        // talking to the server. The actual signing key lives in the
        // platform key store, not in our IndexedDB.
        const stub = await this.makeNativeStub();
        await this.storage.putSession(stub);
        this.emit({ type: 'bound', sessionId: stub.sessionId });
        return stub;
      }
    }
    const record = await bindViaWebCrypto({
      registerUrl: this.registerUrl,
      subject: args.subject,
      metadata: args.metadata,
      fetchImpl: this.baseFetch,
    });
    await this.storage.putSession(record);
    this.emit({ type: 'bound', sessionId: record.sessionId });
    return record;
  }

  private async makeNativeStub(): Promise<BoundSessionRecord> {
    const placeholder = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )) as CryptoKeyPair;
    return {
      sessionId: 'tf_sess_native_pending',
      refreshUrl: this.registerUrl,
      lastChallenge: '',
      publicKeyJwk: { kty: 'EC', crv: 'P-256' },
      privateKey: placeholder.privateKey,
      bindingClass: 'native_dbsc',
      createdAt: new Date().toISOString(),
    };
  }

  async refreshIfNeeded(): Promise<boolean> {
    const session = await this.storage.getSession();
    if (!session) return false;
    const dpop = await signDpop(session.privateKey, {
      sub: session.sessionId,
      nonce: session.lastChallenge,
    });
    const res = await this.baseFetch(session.refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { DPoP: dpop },
    });
    if (!res.ok) {
      this.emit({ type: 'binding_lost', error: new Error(`refresh_${res.status}`) });
      return false;
    }
    const body = (await res.json().catch(() => ({}))) as { challenge?: string; action?: string };
    if (body.challenge) await this.storage.updateChallenge(body.challenge);
    this.emit({ type: 'refreshed', sessionId: session.sessionId, nextChallenge: body.challenge ?? '' });
    return body.action !== 'block';
  }

  async unbind(): Promise<void> {
    await this.storage.clear();
  }

  installFetch(): void {
    if (this.originalFetch) return;
    this.originalFetch = globalThis.fetch;
    globalThis.fetch = makeInterceptingFetch({
      storage: this.storage,
      emit: (e) => this.emit(e),
      baseFetch: this.originalFetch.bind(globalThis),
    });
  }

  uninstallFetch(): void {
    if (!this.originalFetch) return;
    globalThis.fetch = this.originalFetch;
    this.originalFetch = null;
  }

  private emit(event: TokenForgeEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // listener errors are swallowed to keep SDK behaviour deterministic
      }
    }
  }
}
