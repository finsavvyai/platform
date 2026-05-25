'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useApiKeyContext } from './api-key-context';

interface CachedSessionToken {
  token: string;
  expiresAt: number;
}

// Module-scoped cache so the BFF mint call runs at most once per tab session
// (renewed before the 1h TTL expires). Avoids refetching on every hook mount.
let cachedSessionToken: CachedSessionToken | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchSessionToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedSessionToken && cachedSessionToken.expiresAt > now + 60) {
    return cachedSessionToken.token;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch('/api/session-token', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = (await res.json()) as { token: string; expiresIn: number };
      cachedSessionToken = {
        token: data.token,
        expiresAt: now + data.expiresIn,
      };
      return data.token;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Resolve an API token for the dashboard, in priority order:
 *   1. API key cookie (`tf_dk`) — set when ApiKeyGenerator revealed a key
 *   2. Auth.js JWT claim `session.user.apiKey` — pushed via update() on signup
 *   3. Session-minted `sjwt_` token from /api/session-token BFF — default path
 * Returning null signals "not signed in".
 */
export function useApiKey(): string | null {
  const { apiKey: contextKey } = useApiKeyContext();
  const { data: session, status } = useSession();
  const [bootstrapped, setBootstrapped] = useState<string | null>(
    cachedSessionToken?.token ?? null,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionKey = (session?.user as any)?.apiKey as string | undefined;
  const directKey = contextKey ?? sessionKey ?? null;

  useEffect(() => {
    if (directKey) return;
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetchSessionToken().then((t) => {
      if (!cancelled) setBootstrapped(t);
    });
    return () => { cancelled = true; };
  }, [directKey, status]);

  return directKey ?? bootstrapped;
}

interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: (token: string, signal: AbortSignal) => Promise<T>,
): UseApiResult<T> {
  const apiKey = useApiKey();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!apiKey) { setLoading(false); return; }
    const controller = new AbortController();
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher(apiKey!, controller.signal);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; controller.abort(); };
  }, [apiKey, fetcher, tick]);

  return { data, error, loading, refetch };
}
