/**
 * SSO Authentication Hook
 *
 * Provides SSO authentication with SAML and OIDC providers
 */

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../lib/enhanced-api-client';
import { SSO_PROVIDERS } from './ssoTypes';
import type {
  CreateSSOSessionRequest,
  SSOAuthenticationResult,
  UseSSOAuthReturn,
} from './ssoTypes';

export type {
  SSOSession,
  SSOAuthenticationResult,
  CreateSSOSessionRequest,
  SSOProvider,
  SSOProviderConfig,
  UseSSOAuthReturn,
  LinkSSORequest,
  UnlinkSSORequest,
} from './ssoTypes';
export { SSO_PROVIDERS } from './ssoTypes';
export {
  parseCallbackParams,
  getProviderInfo,
  isProviderConfigured,
  formatProviderName,
  getProviderIcon,
  validateSSOSession,
  getSessionTimeRemaining,
  formatSessionTimeRemaining,
  extractUserGroups,
  extractUserRoles,
  mapGroupsToRoles,
  generateRedirectURL,
  isSSOCallback,
  handleSSOCallbackAuto,
  getSSOError,
  formatSSOError,
  buildSSOLoginURL,
  hasSSOEnabled,
  getUserSSOProviders,
} from './ssoUtils';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSSOAuth(): UseSSOAuthReturn {
  const [error, setError] = useState<Error | null>(null);

  // Initiate SSO mutation
  const initiateMutation = useMutation({
    mutationFn: async (request: CreateSSOSessionRequest) => {
      const response = await apiClient.request<{ authUrl: string; sessionId: string }>(
        'POST',
        '/api/v1/sso/session/create',
        request
      );
      return response;
    },
    onSuccess: (data) => {
      // Redirect to SSO provider
      window.location.href = data.authUrl;
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to initiate SSO'));
    },
  });

  // Handle callback mutation
  const callbackMutation = useMutation({
    mutationFn: async ({ code, state }: { code: string; state: string }) => {
      const response = await apiClient.request<SSOAuthenticationResult>(
        'POST',
        '/api/v1/sso/callback/oidc',
        { code, state }
      );
      return response;
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('SSO authentication failed'));
    },
  });

  // Initiate SSO
  const initiateSSO = useCallback(async (request: CreateSSOSessionRequest) => {
    return initiateMutation.mutateAsync(request);
  }, [initiateMutation]);

  // Handle callback
  const handleCallback = useCallback(async (code: string, state: string): Promise<SSOAuthenticationResult> => {
    return callbackMutation.mutateAsync({ code, state });
  }, [callbackMutation]);

  return {
    // SSO operations
    initiateSSO,
    handleCallback,

    // Provider configuration
    providers: SSO_PROVIDERS,

    // State
    isLoading: initiateMutation.isPending || callbackMutation.isPending,
    isInitiating: initiateMutation.isPending,
    error,
  };
}

