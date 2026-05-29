/**
 * SSO Authentication — utility functions
 */

import type { SSOProvider, SSOProviderConfig, SSOSession, SSOAuthenticationResult } from './ssoTypes';
import { SSO_PROVIDERS } from './ssoTypes';

export function parseCallbackParams(): { code?: string; state?: string; error?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
    error: params.get('error') || undefined,
  };
}

export function getProviderInfo(providerId: SSOProvider): SSOProviderConfig | undefined {
  return SSO_PROVIDERS.find(p => p.id === providerId);
}

export function isProviderConfigured(providerId: SSOProvider): boolean {
  return getProviderInfo(providerId)?.configured || false;
}

export function formatProviderName(providerId: SSOProvider): string {
  return getProviderInfo(providerId)?.name || providerId;
}

export function getProviderIcon(providerId: SSOProvider): string {
  return getProviderInfo(providerId)?.icon || '🔑';
}

export function validateSSOSession(session: SSOSession | null): boolean {
  if (!session) return false;
  return new Date() < new Date(session.expiresAt);
}

export function getSessionTimeRemaining(session: SSOSession | null): number {
  if (!session) return 0;
  const remaining = new Date(session.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

export function formatSessionTimeRemaining(session: SSOSession | null): string {
  const seconds = getSessionTimeRemaining(session);
  if (seconds === 0) return 'Expired';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

export function extractUserGroups(attributes: Record<string, string>): string[] {
  const groupsAttr = attributes['groups'] || attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'];
  if (!groupsAttr) return [];
  return groupsAttr.split(',').map(g => g.trim()).filter(g => g.length > 0);
}

export function extractUserRoles(attributes: Record<string, string>): string[] {
  const rolesAttr = attributes['roles'] || attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/roles'];
  if (!rolesAttr) return [];
  return rolesAttr.split(',').map(r => r.trim()).filter(r => r.length > 0);
}

export function mapGroupsToRoles(groups: string[], mapping: Record<string, string>): string[] {
  const roles: Set<string> = new Set();
  groups.forEach(group => { const role = mapping[group]; if (role) roles.add(role); });
  return Array.from(roles);
}

export function generateRedirectURL(): string {
  const url = new URL(window.location.href);
  ['code', 'state', 'error', 'error_description'].forEach(p => url.searchParams.delete(p));
  return url.toString();
}

export function isSSOCallback(): boolean {
  const params = parseCallbackParams();
  return !!(params.code || params.error);
}

export async function handleSSOCallbackAuto(): Promise<SSOAuthenticationResult | null> {
  if (!isSSOCallback()) return null;
  const { code, state } = parseCallbackParams();
  if (!code || !state) { console.error('Missing code or state in callback'); return null; }
  return null;
}

export function getSSOError(): string | null {
  return parseCallbackParams().error || null;
}

export function formatSSOError(error: string): string {
  const errorMessages: Record<string, string> = {
    'access_denied': 'Access was denied. Please check your permissions.',
    'invalid_request': 'Invalid authentication request.',
    'unauthorized_client': 'Unauthorized application.',
    'server_error': 'Authentication server error. Please try again.',
    'temporarily_unavailable': 'Service temporarily unavailable. Please try again.',
  };
  return errorMessages[error] || `Authentication error: ${error}`;
}

export function buildSSOLoginURL(provider: SSOProvider, redirectUrl?: string): string {
  const params = new URLSearchParams();
  params.set('provider', provider);
  params.set('redirect', redirectUrl || generateRedirectURL());
  return `/auth/sso/login?${params.toString()}`;
}

export function hasSSOEnabled(user: any): boolean {
  return user?.ssoEnabled || user?.ssoProviders?.length > 0;
}

export function getUserSSOProviders(user: any): string[] {
  if (!user?.ssoProviders) return [];
  return Array.isArray(user.ssoProviders) ? user.ssoProviders : Object.keys(user.ssoProviders);
}
