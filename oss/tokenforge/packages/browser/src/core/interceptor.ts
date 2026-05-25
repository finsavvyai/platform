/**
 * Fetch interceptor.
 *
 * Wraps a fetch implementation so that any 401 carrying a
 * `Sec-Session-Challenge: <nonce>` header triggers an automatic
 * DPoP-signed refresh against the bound session's `refresh_url`,
 * after which the original request is replayed exactly once.
 *
 * Not exported as a global side-effect — `TokenForge.installFetch()`
 * is the entry point that mutates `globalThis.fetch` opt-in.
 */

import type { BindingStorage, TokenForgeListener } from '../types.js';
import { signDpop } from './signer.js';

const REFRESH_HEADER = 'sec-session-challenge';

export interface InterceptorDeps {
  storage: BindingStorage;
  emit: (...args: Parameters<TokenForgeListener>) => void;
  baseFetch: typeof globalThis.fetch;
}

export function makeInterceptingFetch(deps: InterceptorDeps): typeof globalThis.fetch {
  const intercepting: typeof globalThis.fetch = async (input, init) => {
    const original = await deps.baseFetch(input, init);
    if (original.status !== 401) return original;
    const nonce = original.headers.get(REFRESH_HEADER);
    if (!nonce) return original;

    const session = await deps.storage.getSession();
    if (!session) return original;

    let refreshed: Response;
    try {
      refreshed = await refresh(deps, session.refreshUrl, session.privateKey, session.sessionId, nonce);
    } catch (e) {
      deps.emit({ type: 'binding_lost', error: e });
      return original;
    }

    if (!refreshed.ok) {
      if (refreshed.status === 403) deps.emit({ type: 'session_revoked', reason: 'server_403' });
      return original;
    }

    const body = (await refreshed.clone().json().catch(() => ({}))) as {
      challenge?: string;
      action?: 'allow' | 'step_up' | 'block';
      signals?: string[];
    };
    if (body.challenge) await deps.storage.updateChallenge(body.challenge);
    if (body.action === 'step_up') {
      deps.emit({ type: 'step_up_required', signals: body.signals ?? [] });
      return original;
    }
    if (body.action === 'block') {
      deps.emit({ type: 'session_revoked', reason: 'policy_block' });
      return original;
    }
    deps.emit({ type: 'refreshed', sessionId: session.sessionId, nextChallenge: body.challenge ?? '' });
    return await deps.baseFetch(input, init);
  };
  return intercepting;
}

async function refresh(
  deps: InterceptorDeps,
  refreshUrl: string,
  privateKey: CryptoKey,
  sessionId: string,
  nonce: string,
): Promise<Response> {
  const dpop = await signDpop(privateKey, { sub: sessionId, nonce });
  return await deps.baseFetch(refreshUrl, {
    method: 'POST',
    credentials: 'include',
    headers: { DPoP: dpop },
  });
}
