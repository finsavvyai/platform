export type AuthProvider =
  | 'github'
  | 'gitlab'
  | 'google'
  | 'linkedin'
  | 'facebook'
  | 'bitbucket'
  | 'microsoft';

export const ALL_PROVIDERS: readonly AuthProvider[] = [
  'github',
  'gitlab',
  'google',
  'linkedin',
  'facebook',
  'bitbucket',
  'microsoft',
] as const;

export interface User {
  login: string;
  avatar_url: string;
  name: string;
  provider?: AuthProvider;
}

export interface ProviderConfig {
  clientId: string;
  baseUrl?: string;
}

export type ProviderAvailability = Record<AuthProvider, boolean>;

export function isAuthProvider(value: string | null | undefined): value is AuthProvider {
  return (
    value === 'github' ||
    value === 'gitlab' ||
    value === 'google' ||
    value === 'linkedin' ||
    value === 'facebook' ||
    value === 'bitbucket' ||
    value === 'microsoft'
  );
}

export function parseProviderFromState(state: string | null): AuthProvider | null {
  if (!state) return null;
  const [provider] = state.split(':', 1);
  return isAuthProvider(provider) ? provider : null;
}

export function providerLabel(provider: AuthProvider): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
