'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createTokenForge, type TokenForge } from '../client/index.js';

interface TokenForgeContextValue {
  isReady: boolean;
  isBound: boolean;
  deviceId: string | null;
  trustScore: number | null;
}

const TokenForgeContext = createContext<TokenForgeContextValue>({
  isReady: false,
  isBound: false,
  deviceId: null,
  trustScore: null,
});

interface TokenForgeProviderProps {
  children: ReactNode;
  /** The current session ID from your auth provider */
  sessionId: string | null;
  /** Whether the user is signed in */
  isSignedIn: boolean;
  /** Base URL for the TokenForge-protected API */
  apiBase: string;
}

/**
 * React context provider for TokenForge device binding.
 * Initializes the client SDK when the user is signed in and
 * exposes binding state to descendant components via `useTokenForge`.
 * @param props - Provider props (children, sessionId, isSignedIn, apiBase).
 */
export function TokenForgeProvider({
  children,
  sessionId,
  isSignedIn,
  apiBase,
}: TokenForgeProviderProps) {
  const [state, setState] = useState<TokenForgeContextValue>({
    isReady: false,
    isBound: false,
    deviceId: null,
    trustScore: null,
  });

  useEffect(() => {
    if (!isSignedIn || !sessionId) return;

    let tf: TokenForge | null = null;

    const setup = async () => {
      tf = createTokenForge({
        apiBase,
        getSessionId: () => sessionId,
        onStepUpRequired: (reason) => {
          window.dispatchEvent(
            new CustomEvent('tf:step-up', { detail: reason }),
          );
        },
        onSessionRevoked: () => {
          window.location.href = '/sign-in?reason=session_revoked';
        },
        onDeviceBound: (deviceId) => {
          setState((s) => ({ ...s, isBound: true, deviceId }));
        },
      });

      await tf.init();
      setState((s) => ({ ...s, isReady: true }));
    };

    setup().catch(console.error);

    return () => {
      tf?.clearKeys().catch(console.error);
    };
  }, [sessionId, isSignedIn, apiBase]);

  return (
    <TokenForgeContext.Provider value={state}>
      {children}
    </TokenForgeContext.Provider>
  );
}

/**
 * Access the TokenForge device-binding context.
 * @returns Current binding state (isReady, isBound, deviceId, trustScore).
 */
export function useTokenForge() {
  return useContext(TokenForgeContext);
}
