/**
 * Authentication Hook
 *
 * Manages user authentication state with React Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../services/enhanced-api-services';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get current user profile
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.auth.profile(),
    queryFn: () => api.auth.getProfile(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      api.auth.login(credentials.email, credentials.password) as Promise<AuthTokens>,
    onSuccess: async (data: AuthTokens) => {
      // Store tokens
      localStorage.setItem('auth_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);

      // Invalidate and refetch profile
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile() });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (credentials: RegisterCredentials) =>
      api.auth.register(credentials.email, credentials.password, credentials.name) as Promise<AuthTokens>,
    onSuccess: async (data: AuthTokens) => {
      // Store tokens
      localStorage.setItem('auth_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);

      // Invalidate and refetch profile
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile() });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: async () => {
      // Clear tokens
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');

      // Clear all queries
      await queryClient.clear();

      // Reset query state
      queryClient.resetQueries();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<User>) => api.auth.updateProfile(data),
    onSuccess: async () => {
      // Invalidate and refetch profile
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile() });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { oldPassword: string; newPassword: string }) =>
      api.auth.changePassword(data.oldPassword, data.newPassword),
  });

  const isAuthenticated = !!user && !error;
  const isLoadingAuth = isLoading;

  return {
    user,
    isAuthenticated,
    isLoading: isLoadingAuth,
    error,

    // Mutations
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: () => logoutMutation.mutate(),
    updateProfile: updateProfileMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,

    // Mutation states
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,

    // Mutation errors
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    logoutError: logoutMutation.error,
    updateProfileError: updateProfileMutation.error,
    changePasswordError: changePasswordMutation.error,
  };
}

/**
 * Simple hook to check authentication status
 */
export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useAuth();
  return { isAuthenticated, isLoading };
}
