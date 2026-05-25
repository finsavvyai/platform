const KNOWN: Record<string, string> = {
  access_denied: 'Access was denied.',
  server_error: 'Authentication server error. Please try again.',
  temporarily_unavailable: 'Authentication is temporarily unavailable.',
  invalid_request: 'OAuth login failed. Please try again.',
}

const LEAK_PATTERNS = [/host=/i, /database=/i, /no such host/i, /lookup\s+\S+/i, /failed to connect/i, /password=/i, /user=/i]

export function friendlyAuthError(raw: string | null | undefined): string {
  if (!raw) return ''
  if (KNOWN[raw]) return KNOWN[raw]
  if (LEAK_PATTERNS.some((re) => re.test(raw))) {
    return 'We could not complete sign in right now. Please try again in a moment.'
  }
  return raw.length > 160 ? 'Sign in failed. Please try again.' : raw
}
