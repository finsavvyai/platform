'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const COOKIE_NAME = 'tf_dk';

function getCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function setCookie(value: string): void {
  // Session cookie — expires when browser closes. SameSite=Strict for security.
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; SameSite=Strict; Secure`;
}

interface ApiKeyContextValue {
  apiKey: string | null;
  setApiKey: (key: string) => void;
}

const ApiKeyContext = createContext<ApiKeyContextValue>({
  apiKey: null,
  setApiKey: () => {},
});

export function ApiKeyProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  // Lazy initializer reads the cookie once at mount — that's the only sync
  // point we need. The prior re-read-via-useEffect was redundant and the
  // react-hooks/set-state-in-effect rule rightly flagged it as cascading.
  const [apiKey, setApiKeyState] = useState<string | null>(() => getCookie());

  const setApiKey = useCallback((key: string) => {
    setCookie(key);
    setApiKeyState(key);
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKeyContext(): ApiKeyContextValue {
  return useContext(ApiKeyContext);
}
