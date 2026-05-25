'use client';

import { TokenForgeProvider } from '@opensyber/tokenforge/react';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Bridges the server-side Auth.js session into the TokenForge React
 * provider. The underlying `TokenForgeProvider` needs a stable session
 * identifier that the client can see — Auth.js issues JWTs which aren't
 * directly accessible in the browser, so we derive a stable per-tab
 * session identifier from `sessionStorage` and keep it coherent across
 * the dashboard lifetime.
 *
 * Once mounted, this component:
 * 1. Generates a non-extractable ECDSA P-256 keypair via Web Crypto
 * 2. Binds the device via `POST /api/tf/bind` (allowlisted, no TF headers needed)
 * 3. Installs a global `fetch` interceptor that signs every subsequent
 *    request to the API with the 4 `X-TF-*` headers the server expects
 *
 * After successful binding, sensitive operations like storing secrets
 * stop returning 403 `device_binding_required`.
 */
export function TokenForgeBridge({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setSessionId(null));
      return;
    }
    // One stable identifier per browser tab + user combination.
    // The server-side TokenForge session record is keyed by this value.
    const storageKey = `tf:session:${userId}`;
    let existing = sessionStorage.getItem(storageKey);
    if (!existing) {
      existing = crypto.randomUUID();
      sessionStorage.setItem(storageKey, existing);
    }
    queueMicrotask(() => setSessionId(existing));
  }, [userId]);

  return (
    <TokenForgeProvider
      sessionId={sessionId}
      isSignedIn={Boolean(userId)}
      apiBase=""
    >
      {children}
    </TokenForgeProvider>
  );
}
