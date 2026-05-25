// SDLC Context Provider for React applications

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrowserClient, NodeClient, SDLCConfig } from '../../client';
import { AuthUser, AuthTokens } from '../../types';

interface SDLCContextValue {
  client: BrowserClient | NodeClient;
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string; mfaCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SDLCContext = createContext<SDLCContextValue | null>(null);

interface SDLCProviderProps {
  children: ReactNode;
  config: SDLCConfig;
  autoAuthenticate?: boolean;
}

export function SDLCProvider({ children, config, autoAuthenticate = true }: SDLCProviderProps) {
  const [client, setClient] = useState<BrowserClient | NodeClient | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize client
  useEffect(() => {
    const sdkClient = config.environment === 'node' || typeof window === 'undefined'
      ? new NodeClient(config)
      : new BrowserClient(config);

    setClient(sdkClient);

    // Setup auth event listeners
    const handleLogin = ({ user: loggedUser, tokens: newTokens }: any) => {
      setUser(loggedUser);
      setTokens(newTokens);
      setIsLoading(false);
    };

    const handleLogout = () => {
      setUser(null);
      setTokens(null);
      setIsLoading(false);
    };

    const handleTokenRefreshed = (newTokens: AuthTokens) => {
      setTokens(newTokens);
    };

    sdkClient.auth.on('login', handleLogin);
    sdkClient.auth.on('logout', handleLogout);
    sdkClient.auth.on('tokenRefreshed', handleTokenRefreshed);

    // Auto-authenticate if enabled
    if (autoAuthenticate) {
      sdkClient.auth.isAuthenticated().then((authenticated: boolean) => {
        if (authenticated) {
          sdkClient.auth.getCurrentUser().then((currentUser: AuthUser) => {
            setUser(currentUser);
            setTokens(sdkClient.auth.getTokens() || null);
          }).catch(() => {
            // Invalid session
          });
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      sdkClient.auth.off('login', handleLogin);
      sdkClient.auth.off('logout', handleLogout);
      sdkClient.auth.off('tokenRefreshed', handleTokenRefreshed);
    };
  }, [config, autoAuthenticate]);

  const login = async (credentials: { email: string; password: string; mfaCode?: string }) => {
    if (!client) throw new Error('SDK client not initialized');

    setIsLoading(true);
    try {
      await client.auth.login(credentials);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!client) throw new Error('SDK client not initialized');

    setIsLoading(true);
    try {
      await client.auth.logout();
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    if (!client) throw new Error('SDK client not initialized');

    try {
      await client.auth.refreshToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  const value: SDLCContextValue = {
    client: client!,
    user,
    tokens,
    isLoading,
    isAuthenticated: !!user && !!tokens,
    login,
    logout,
    refresh
  };

  return (
    <SDLCContext.Provider value={value}>
      {children}
    </SDLCContext.Provider>
  );
}

export function useSDLC() {
  const context = useContext(SDLCContext);
  if (!context) {
    throw new Error('useSDLC must be used within an SDLCProvider');
  }
  return context;
}
