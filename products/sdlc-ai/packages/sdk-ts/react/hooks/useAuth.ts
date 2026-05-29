// Authentication hook for React

import { useState, useEffect, useCallback } from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import { LoginCredentials, AuthUser } from '../../types';

export function useAuth() {
  const { client, user, tokens, isLoading, isAuthenticated, login, logout, refresh } = useSDLC();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setIsLoggingIn(true);
    setError(null);

    try {
      await login(credentials);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, [login]);

  const handleLogout = useCallback(async () => {
    setError(null);
    await logout();
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    setError(null);
    await refresh();
  }, [refresh]);

  const updateProfile = useCallback(async (data: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  }) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);
    try {
      const updatedUser = await client.auth.updateProfile(data);
      return updatedUser;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!client) throw new Error('Client not initialized');

    setError(null);
    try {
      await client.auth.changePassword(currentPassword, newPassword);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const enableMFA = useCallback(async () => {
    if (!client) throw new Error('Client not initialized');

    setError(null);
    try {
      const result = await client.auth.enableMFA();
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [client]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    tokens,
    isLoading,
    isLoggingIn,
    isAuthenticated,
    error,
    login: handleLogin,
    logout: handleLogout,
    refresh: handleRefresh,
    updateProfile,
    changePassword,
    enableMFA,
    clearError
  };
}
